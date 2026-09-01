const PHI=(1+Math.sqrt(5))/2;
const fileInput=document.querySelector("#file"),dropzone=document.querySelector("#dropzone"),canvas=document.querySelector("#preview"),ctx=canvas.getContext("2d");
const findBtn=document.querySelector("#findBtn"),saveBtn=document.querySelector("#saveBtn"),resetBtn=document.querySelector("#resetBtn"),previewWrap=document.querySelector("#previewWrap"),statusEl=document.querySelector("#status");
const DEFAULT_STATUS="画像を入れると、雑に探索します。";
let image=null,originalName="golden-ish.png",edgeCache=null,loadToken=0;

const setStatus=t=>{statusEl.textContent=t};
const isHeic=file=>/heic|heif/i.test(file.type)||/\.(heic|heif)$/i.test(file.name);

/* ---------- ファイル読み込み ---------- */
fileInput.addEventListener("change",e=>loadFile(e.target.files[0]));

function loadFile(file){
  if(!file)return;
  if(!file.type.startsWith("image/")){setStatus("画像ファイルを選んでください（JPG / PNG / WEBP）。");return}
  // 続けて画像を選んだとき、古い読み込みの結果で今の状態を上書きしないようにする。
  // オブジェクトURLは各読み込みが自分の分だけを解放する。
  const token=++loadToken;
  const url=URL.createObjectURL(file);
  const name=file.name.replace(/\.[^.]+$/,"")+"-zatsu-golden.png";
  const img=new Image();
  img.onload=()=>{
    URL.revokeObjectURL(url);
    if(token!==loadToken)return;          // すでに次の画像が選ばれている
    image=img;
    originalName=name;
    edgeCache=null;                       // 画像が変わったらエッジ結果を捨てる
    drawBase();
    findBtn.disabled=false;
    previewWrap.classList.remove("hidden");
    dropzone.classList.add("compact");    // 読み込み後は細いバーに畳む
    saveBtn.classList.add("hidden");
    resetBtn.classList.remove("hidden");
    canvas.setAttribute("aria-label","読み込んだ画像");
    setStatus("画像を読み込みました。では、雑に探します。");
  };
  img.onerror=()=>{
    URL.revokeObjectURL(url);
    if(token!==loadToken)return;
    setStatus(isHeic(file)
      ? "HEIC形式はブラウザで開けませんでした。JPEGやPNGでお試しください。"
      : "この画像を読み込めませんでした。別のファイルでお試しください。");
  };
  img.src=url;
}

/* ---------- ドラッグ＆ドロップ ---------- */
// ドロップゾーン外に落としたときにブラウザがそのファイルへ遷移するのを防ぐ
["dragover","drop"].forEach(t=>window.addEventListener(t,e=>e.preventDefault()));

// dragleaveは子要素をまたぐたびに飛ぶので、出入りを数えて枠線のちらつきを防ぐ
let dragDepth=0;
const endDrag=()=>{dragDepth=0;dropzone.classList.remove("drag")};
dropzone.addEventListener("dragenter",e=>{e.preventDefault();dragDepth++;dropzone.classList.add("drag")});
dropzone.addEventListener("dragover",e=>e.preventDefault());
dropzone.addEventListener("dragleave",e=>{e.preventDefault();if(--dragDepth<=0)endDrag()});
dropzone.addEventListener("drop",e=>{e.preventDefault();endDrag();loadFile(e.dataTransfer.files[0])});

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
  const {edge,w,h}=(edgeCache||=grayAndEdges()),candidates=[],sizes=[.22,.30,.40,.52,.64,.78];
  for(const frac of sizes){const rw=Math.min(w*.82,Math.max(24,w*frac)),rh=rw/PHI;if(rh>h*.86)continue;
    for(let yi=0;yi<5;yi++)for(let xi=0;xi<7;xi++){const x=Math.max(0,Math.min(w-rw,(w-rw)*xi/6+(Math.random()-.5)*w*.16)),y=Math.max(0,Math.min(h-rh,(h-rh)*yi/4+(Math.random()-.5)*h*.16));candidates.push({type:"rectangle",x,y,rw,rh,score:scoreRect(edge,w,h,x,y,rw,rh)+Math.random()*.035})}
  }
  const radii=[Math.min(w,h)*.16,Math.min(w,h)*.23,Math.min(w,h)*.31,Math.min(w,h)*.40];
  for(const radius of radii)for(let yi=0;yi<4;yi++)for(let xi=0;xi<5;xi++){const cx=w*(.12+xi*.19)+(Math.random()-.5)*w*.10,cy=h*(.14+yi*.24)+(Math.random()-.5)*h*.12;candidates.push({type:"spiral",cx:Math.max(0,Math.min(w,cx)),cy:Math.max(0,Math.min(h,cy)),radius,score:spiralScore(edge,w,h,cx,cy,radius)+Math.random()*.035})}
  candidates.sort((a,b)=>b.score-a.score);const pool=candidates.slice(0,Math.min(10,candidates.length));return{best:pool[Math.floor(Math.pow(Math.random(),.72)*pool.length)],w,h}
}
function label(x,y,text){
  ctx.save();
  ctx.globalAlpha=1;                       // 呼び出し元の半透明設定を引き継がない
  const fs=Math.max(12,Math.min(28,canvas.width/38));
  ctx.font=`600 ${fs}px ui-sans-serif,"Hiragino Sans","Yu Gothic",sans-serif`;
  const padX=fs*.7,padY=fs*.45,bw=ctx.measureText(text).width+padX*2,bh=fs+padY*2;
  // キャンバスからはみ出さない位置に収める（小さい画像・スマホ幅対策）
  const bx=Math.max(0,Math.min(canvas.width-bw,x));
  const by=y-bh-6>=0?y-bh-6:Math.min(canvas.height-bh,Math.max(0,y+6));
  ctx.fillStyle="rgba(30,30,28,.85)";
  ctx.beginPath();ctx.roundRect(bx,by,bw,bh,bh*.28);ctx.fill();
  ctx.fillStyle="#fffdf8";ctx.textBaseline="middle";
  ctx.fillText(text,bx+padX,by+bh/2);
  ctx.restore()
}
function drawGoldenOverlay(c,aW,aH){
  drawBase();const sx=canvas.width/aW,sy=canvas.height/aH;ctx.save();ctx.strokeStyle="#e6b51e";ctx.lineWidth=Math.max(2,canvas.width/500);ctx.globalAlpha=.9;
  if(c.type==="rectangle"){const x=c.x*sx,y=c.y*sy,rw=c.rw*sx,rh=c.rh*sy;ctx.strokeRect(x,y,rw,rh);let rx=x,ry=y,ww=rw,hh=rh;ctx.globalAlpha=.58;
    for(let i=0;i<6;i++){const side=Math.min(ww,hh);ctx.strokeRect(rx,ry,side,side);if(ww>hh){rx+=side;ww-=side}else{ry+=side;hh-=side}}
    ctx.globalAlpha=.95;ctx.lineWidth*=1.35;const pts=[];for(let i=0;i<=180;i++){const t=i/180,ang=t*Math.PI*3,scale=Math.pow(.17,t);pts.push([x+rw*.82+Math.cos(ang)*rw*.42*scale,y+rh*.55+Math.sin(ang)*rw*.42*scale])}
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();label(x,y,"ここ、たぶん黄金比")
  }else{const cx=c.cx*sx,cy=c.cy*sy,r=c.radius*(sx+sy)/2;ctx.globalAlpha=.95;ctx.lineWidth*=1.5;const pts=[];for(let i=0;i<=220;i++){const t=i/220,ang=-Math.PI*.45+t*Math.PI*2*1.85,rr=r*Math.pow(.16,t);pts.push([cx+Math.cos(ang)*rr,cy+Math.sin(ang)*rr])}ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();ctx.globalAlpha=.45;const box=r*1.55;ctx.strokeRect(cx-box*.6,cy-box*.6,box*1.2,box*1.2);label(cx-box*.6,cy-box*.6,"このへん、黄金螺旋っぽい")}
  ctx.restore()
}
/* ---------- 探す ---------- */
findBtn.addEventListener("click",()=>{
  if(!image)return;
  findBtn.disabled=true;
  setStatus("エッジを眺めています……。今回は前回と違うかもしれません。");
  // requestAnimationFrameは非表示タブだと発火しないため、setTimeoutで逃がす
  setTimeout(()=>{
    try{
      const r=findGoldenCandidate();
      drawGoldenOverlay(r.best,r.w,r.h);
      const msg=r.best.type==="spiral"
        ? "黄金螺旋っぽい場所を見つけました。たぶん。"
        : "黄金長方形っぽい場所を見つけました。たぶん。";
      setStatus(msg);
      canvas.setAttribute("aria-label",msg);
      saveBtn.classList.remove("hidden");
    }catch(err){
      console.error(err);
      setStatus("探索中に問題が起きました。もう一度お試しください。");
    }finally{
      findBtn.disabled=false;
    }
  },30);
});

/* ---------- 保存・共有 ---------- */
// iOS Safariはdata URLの<a download>を無視するのでBlobを使う。
// 共有できる端末では共有シート（カメラロール保存やLINE送信）を優先する。
function canShareImages(){
  try{
    return !!(navigator.canShare&&navigator.share&&
      navigator.canShare({files:[new File([new Blob([1])],"a.png",{type:"image/png"})]}));
  }catch(err){return false}
}
if(canShareImages())saveBtn.textContent="画像を共有・保存";

saveBtn.addEventListener("click",async()=>{
  saveBtn.disabled=true;
  try{
    const blob=await new Promise(res=>canvas.toBlob(res,"image/png"));
    if(!blob){setStatus("画像の書き出しに失敗しました。");return}
    const file=new File([blob],originalName,{type:"image/png"});
    if(navigator.canShare?.({files:[file]})){
      try{
        await navigator.share({files:[file],title:"雑な黄金比"});
        return;
      }catch(err){
        if(err.name==="AbortError")return;   // ユーザーが閉じただけ
        // 共有に失敗したらダウンロードにフォールバック
      }
    }
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=originalName;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(err){
    console.error(err);
    setStatus("保存できませんでした。もう一度お試しください。");
  }finally{
    saveBtn.disabled=false;
  }
});

/* ---------- やり直し ---------- */
resetBtn.addEventListener("click",()=>{
  loadToken++;                            // 読み込み中のものがあれば無効化する
  image=null;edgeCache=null;
  fileInput.value="";
  ctx.clearRect(0,0,canvas.width,canvas.height);
  previewWrap.classList.add("hidden");
  dropzone.classList.remove("compact");
  saveBtn.classList.add("hidden");
  resetBtn.classList.add("hidden");
  findBtn.disabled=true;
  canvas.setAttribute("aria-label","読み込んだ画像");
  setStatus(DEFAULT_STATUS);
});
