# Firebase Hosting Setup for BBO Challenge

這個專案是純前端靜態網站，已經包含 Firebase Hosting 的本地設定檔。

## 已新增的檔案

- `firebase.json`
- `.firebaserc`

預設 `projectId` 設為 `bbo-challenge`，它對應的預設網域會是：

- `https://bbo-challenge.web.app`
- `https://bbo-challenge.firebaseapp.com`

> 注意：Firebase 專案 ID 必須小寫並且只能包含英數字與連字號。如果 `bbo-challenge` 已被占用，請改成其他可用的 ID，例如 `bbo-challenge-2026`，然後更新 `.firebaserc`。

## 部署步驟

1. 安裝 Firebase CLI（如果尚未安裝）：

```powershell
npm install -g firebase-tools
```

2. 登入 Firebase：

```powershell
firebase login
```

3. 建立 Firebase 專案（如果尚未建立）：

```powershell
firebase projects:create bbo-challenge
```

若 `bbo-challenge` 無法使用，可改成其他名稱，如 `bbo-challenge-2026`。

4. 在專案目錄執行：

```powershell
firebase init hosting
```

如果系統詢問，要將專案目錄設為 `public`，請輸入 `.`。

5. 部署到 Firebase Hosting：

```powershell
firebase deploy --only hosting
```

## 部署後網址

若專案 ID 成功建立為 `bbo-challenge`，則網站網址為：

- `https://bbo-challenge.web.app`
- `https://bbo-challenge.firebaseapp.com`

## 注意事項

- Firebase Hosting 提供的網址是免費的。若你要自訂域名，還需要購買自己域名，然後在 Firebase Console 綁定。
- 如果你只想先測試，`firebase deploy` 完成後就能直接使用 `web.app` 網址。
