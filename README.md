# 雑な黄金比

画像の中から黄金長方形や黄金螺旋に「なんとなく似ている」場所を雑に探すジョークサイトです。

## GitHub Pages

1. このフォルダの中身をGitHubリポジトリへpush
2. GitHubの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に変更
3. `main` へpush
4. Actionsが成功するとPagesで公開されます

## ローカル

```bash
npm ci
npm run dev
```

画像解析はすべてブラウザ内で行い、画像を外部サーバーへ送信しません。
