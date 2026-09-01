const PHI=(1+Math.sqrt(5))/2;
const fileInput=document.querySelector("#file"),dropzone=document.querySelector("#dropzone"),canvas=document.querySelector("#preview"),ctx=canvas.getContext("2d");
const findBtn=document.querySelector("#findBtn"),saveBtn=document.querySelector("#saveBtn"),resetBtn=document.querySelector("#resetBtn"),previewWrap=document.querySelector("#previewWrap"),status=document.querySelector("#status");
let image=null,originalName="golden-ish.png";

fileInput.addEventListener("change",e=>loadFile(e.target.files[0]));
["dragenter","dragover"].forEach(t=>dropzone.addEventListener(t,e=>{e.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(t=>dropzone.addEventListener(t,e=>{e.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",e=>loadFile(e.dataTransfer.files[0]));

function loadFile(file){
  if(!file||!file.type.startsWith("image/"))return;
  originalName=file.name.replace(/\.[^.]+$/,"")+"-zatsu-golden.png";
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{image=img;drawBase();findBtn.disabled=false;previewWrap.classList.remove("hidden");saveBtn.classList.add("hidden");resetBtn.classList.remove("hidden");status.textContent="画像を読み込みました。では、雑に探します。";URL.revokeObjectURL(url)};
  img.src=url;
}
function fitSize(w,h,max=1500){const scale=Math.min(1,max/Math.max(w,h));return{w:Math.round(w*scale),h:Math.round(h*scale)}}
function drawBase(){const s=fitSize(image.naturalWidth,image.naturalHeight);canvas.width=s.w;canvas.height=s.h;ctx.drawImage(image,0,0,s.w,s.h)}

function grayAndEdges(){
  const s=fitSize(image.naturalWidth,image.naturalHeight,260),c=document.createElement("canvas");c.width=s.w;c.height=s.h;
  const x=c.getContext("2d");x.drawImage(image,0,0,s.w,s.h);const d=x.getImageData(0,0,s.w,s.h).data,g=new Float32Array(s.w*s.h);
  for(let y=0;y<s.h;y++)for(let xx=0;xx<s.w;xx++){const i=(y*s.w+xx)*4;g[y*s.w+xx]=.299*d[i]+.587*d[i+1]+.114*d[i+2]}
  const e=new Float32Array(s.w*s.h);let maxE=1;
  for(let y=1;y<s.h-1;y++)for(let xx=1;xx<s.w-1;xx++){const i=y*s.w+xx,gx=-g[i-s.w-1]-2*g[i-1]-g[i+s.w-1]+g[i-s.w+1]+2*g[i+1]+g[i+s.w+1],gy=-g[i-s.w-1]-2*g[i-s.w]-g[i-s.w+1]+g[i+s.w-1]+2*g[i+s.w]+g[i+s.w+1],v=Math.hypot(gx,gy);e[i]=v;if(v>maxE)maxE=v}
  for(let i=0;i<e.length;i++)e[i]/=maxE;return{edge:e,w:s.w,h:s.h}
}
function lineScore(edge,w,h,x1,y1,x2,y2,band=2){
  let total=0,count=0,n=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
  for(let k=0;k<=n;k++){const x=Math.round(x1+(x2-x1)*k/n),y=Math.round(y1+(y2-y1)*k/n);for(let dy=-band;dy<=band;dy++)for(let dx=-band;dx<=band;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h){total+=edge[yy*w+xx];count++}}}
  return count?total/count:0
}
function scoreRect(edge,w,h,x,y,rw,rh){return(lineScore(edge,w,h,x,y,x+rw,y)+lineScore(edge,w,h,x,y+rh,x+rw,y+rh)+lineScore(edge,w,h,x,y,x,y+rh)+lineScore(edge,w,h,x+rw,y,x+rw,y+rh))*.22+(lineScore(edge,w,h,x,y,x+rw,y+rh,1)+lineScore(edge,w,h,x+rw,y,x,y+rh,1))*.07}
function sampleEdge(edge,w,h,x,y,band=2){const xx=Math.round(x),yy=Math.round(y);let t=0,c=0;for(let dy=-band;dy<=band;dy++)for(let dx=-band;dx<=band;dx++){const a=xx+dx,b=yy+dy;if(a>=0&&a<w&&b>=0&&b<h){t+=edge[b*w+a];c++}}return c?t/c:0}
function spiralScore(edge,w,h,cx,cy,radius){let total=0,count=0;for(let i=0;i<150;i++){const t=i/149,a=-Math.PI*.45+t*Math.PI*2*1.85,r=radius*Math.pow(.16,t),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;if(x>=0&&x<w&&y>=0&&y<h){total+=sampleEdge(edge,w,h,x,y);count++}}return count?total/count:0}

function findGoldenCandidate(){
  const {edge,w,h}=grayAndEdges(),candidates=[],sizes=[.22,.30,.40,.52,.64,.78];
  for(const frac of sizes){const rw=Math.min(w*.82,Math.max(24,w*frac)),rh=rw/PHI;if(rh>h*.86)continue;
    for(let yi=0;yi<5;yi++)for(let xi=0;xi<7;xi++){const x=Math.max(0,Math.min(w-rw,(w-rw)*xi/6+(Math.random()-.5)*w*.16)),y=Math.max(0,Math.min(h-rh,(h-rh)*yi/4+(Math.random()-.5)*h*.16));candidates.push({type:"rectangle",x,y,rw,rh,score:scoreRect(edge,w,h,x,y,rw,rh)+Math.random()*.035})}
  }
  const radii=[Math.min(w,h)*.16,Math.min(w,h)*.23,Math.min(w,h)*.31,Math.min(w,h)*.40];
  for(const radius of radii)for(let yi=0;yi<4;yi++)for(let xi=0;xi<5;xi++){const cx=w*(.12+xi*.19)+(Math.random()-.5)*w*.10,cy=h*(.14+yi*.24)+(Math.random()-.5)*h*.12;candidates.push({type:"spiral",cx:Math.max(0,Math.min(w,cx)),cy:Math.max(0,Math.min(h,cy)),radius,score:spiralScore(edge,w,h,cx,cy,radius)+Math.random()*.035})}
  candidates.sort((a,b)=>b.score-a.score);const pool=candidates.slice(0,Math.min(10,candidates.length));return{best:pool[Math.floor(Math.pow(Math.random(),.72)*pool.length)],w,h}
}
function label(x,y,text){ctx.save();ctx.font=`${Math.max(11,canvas.width/85)}px sans-serif`;const pad=8,tw=ctx.measureText(text).width,yy=Math.max(0,y-30);ctx.fillStyle="rgba(30,30,28,.85)";ctx.fillRect(x,yy,tw+pad*2,26);ctx.fillStyle="#fffdf8";ctx.fillText(text,x+pad,Math.max(18,yy+18));ctx.restore()}
function drawGoldenOverlay(c,aW,aH){
  drawBase();const sx=canvas.width/aW,sy=canvas.height/aH;ctx.save();ctx.strokeStyle="#e6b51e";ctx.lineWidth=Math.max(2,canvas.width/500);ctx.globalAlpha=.9;
  if(c.type==="rectangle"){const x=c.x*sx,y=c.y*sy,rw=c.rw*sx,rh=c.rh*sy;ctx.strokeRect(x,y,rw,rh);let rx=x,ry=y,ww=rw,hh=rh;ctx.globalAlpha=.58;
    for(let i=0;i<6;i++){const side=Math.min(ww,hh);ctx.strokeRect(rx,ry,side,side);if(ww>hh){rx+=side;ww-=side}else{ry+=side;hh-=side}}
    ctx.globalAlpha=.95;ctx.lineWidth*=1.35;const pts=[];for(let i=0;i<=180;i++){const t=i/180,ang=t*Math.PI*3,scale=Math.pow(.17,t);pts.push([x+rw*.82+Math.cos(ang)*rw*.42*scale,y+rh*.55+Math.sin(ang)*rw*.42*scale])}
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();label(x,y,"ここ、たぶん黄金比")
  }else{const cx=c.cx*sx,cy=c.cy*sy,r=c.radius*(sx+sy)/2;ctx.globalAlpha=.95;ctx.lineWidth*=1.5;const pts=[];for(let i=0;i<=220;i++){const t=i/220,ang=-Math.PI*.45+t*Math.PI*2*1.85,rr=r*Math.pow(.16,t);pts.push([cx+Math.cos(ang)*rr,cy+Math.sin(ang)*rr])}ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();ctx.globalAlpha=.45;const box=r*1.55;ctx.strokeRect(cx-box*.6,cy-box*.6,box*1.2,box*1.2);label(cx-box*.6,cy-box*.6,"このへん、黄金螺旋っぽい")}
  ctx.restore()
}
findBtn.addEventListener("click",()=>{if(!image)return;findBtn.disabled=true;status.textContent="エッジを眺めています……。今回は前回と違うかもしれません。";requestAnimationFrame(()=>{const r=findGoldenCandidate();drawGoldenOverlay(r.best,r.w,r.h);status.textContent=r.best.type==="spiral"?"黄金螺旋っぽい場所を見つけました。たぶん。":"黄金長方形っぽい場所を見つけました。たぶん。";saveBtn.classList.remove("hidden");findBtn.disabled=false})});
saveBtn.addEventListener("click",()=>{const a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download=originalName;a.click()});
resetBtn.addEventListener("click",()=>{image=null;fileInput.value="";previewWrap.classList.add("hidden");saveBtn.classList.add("hidden");resetBtn.classList.add("hidden");findBtn.disabled=true;status.textContent="画像を入れると、雑に探索します。"});
