# MiniBoard Starter — 情報科学演習III

## Local / Codespaces
```bash
pip install -r requirements.txt
python app.py
```

## Docker
```bash
docker build -t miniboard .
docker run --rm -p 5000:5000 miniboard
```

## API
- GET `/api/messages`
- POST `/api/messages`
- PUT `/api/messages/<id>`
- DELETE `/api/messages/<id>`

投稿一覧の「ブックマーク」から投稿を保存できます。保存した投稿は画面上部のブックマーク一覧に表示され、同じブラウザーでは再読み込み後も保持されます（ブラウザー単位の保存で、他の端末とは共有されません）。

投票は署名付きの匿名ブラウザーIDを使い、各投票につき同じブラウザーからは一度だけ受け付けます。ログイン機能はないため、別のブラウザーや端末を使ったりCookieを消去したりした同一人物の重複投票までは防止できません。`FLASK_SECRET_KEY` 環境変数が設定されていない場合は、署名鍵をSQLiteデータベースに保存します。

> 授業用。Public URLに個人情報・秘密情報を入力しないこと。
