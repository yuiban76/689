# 九局下半：連線棒球團隊遊戲

一款以單一球員第一人稱視角遊玩的九人合作棒球 MVP。每位玩家選擇一個守備位置，最多九人同房；不足九人時由免費、規則式 NPC 補位，不使用付費 AI 服務。

## 目前內容

- 最多 9 位真人玩家，每人佔用一個位置：P、C、1B、2B、3B、SS、LF、CF、RF
- 6 隊聯盟、54 名獨立球員，可在賽前切換主隊與對手
- 球員中心：OVR、五工具、左右投拆分、投手球種、年齡、體型、潛力與角色
- 免費本機養成：等級、XP、訓練點、士氣、疲勞與六種訓練方向
- 完整統計：G、PA、AB、R、H、2B、3B、HR、RBI、BB、SO、SB、CS、AVG、OBP、SLG、OPS、ERA、FIP、WHIP、K/9、FPCT、RF/9
- 少於 9 人仍可開始，空缺位置由規則式 NPC 接管
- PeerJS 免費 CDN 連線，支援房號加入、重連與斷線後 NPC 接管
- 打擊、投球、守備、跑壘、得分、半局與九局結算流程
- 快速團隊訊號、守備事件、比分板、戰績與賽後總結
- GitHub Pages 靜態部署，不需要後端伺服器

## 本機啟動

在專案目錄執行：

```powershell
py -m http.server 8000
```

開啟 <http://127.0.0.1:8000/>。連線功能請使用 `http://localhost` 或 GitHub Pages 的 HTTPS 網址，不要直接以 `file://` 開啟。

## GitHub Pages

`.github/workflows/pages.yml` 會在 `main` 分支更新後自動部署。第一次推送後，請在 GitHub 專案的 **Settings → Pages** 將來源設為 **GitHub Actions**；完成後網址通常為：

```text
https://<GitHub帳號>.github.io/<儲存庫名稱>/
```

## 設計文件

完整規則、位置職責、網路同步、NPC 補位、斷線處理與公平性原則請參考 [GAME_DESIGN.md](GAME_DESIGN.md)。
