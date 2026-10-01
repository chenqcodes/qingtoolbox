# 星空与 ISS 预测：模型、数据和验收

## 口径

- `MoonPhase` 是从新月 0°、上弦 90°、满月 180° 到下弦 270° 的周期角。`Illumination.phase_fraction` 只用于亮面面积，不能判断盈亏；`phase_angle` 不是周期角。北向上月相示意不模拟地平旋转角。
- 行星卡片按视星等排序，不再把最高误叫最亮。日间或暮光明确提醒；高度大于零不等于可见。未计天气、消光和地形。
- 所有时间显式使用观测者选择的 IANA 时区，默认北京 / Asia/Shanghai。手动改坐标或 GPS 不会猜测时区，也不在加载时请求定位。日历日升落包含 DST 的 23/25 小时日；重复时刻选较早一次，跳时导致不存在的时刻拒绝。
- ISS SGP4 的几何过境以 0° 地平线起落，峰值筛选 ≥10°。可能可见窗口另要求仰角 ≥10°、太阳 ≤−6°、ISS 未入本影或半影。此筛选是保守近似，不是亮度预报，更不能保证肉眼看见。
- 日照筛选以球形地球及太阳视圆盘遮挡判断，EQD 太阳向量近似 TEME；忽略折射、地球椭率、大气影和空间站姿态。采样找变号区间后，将边界细化到 0.5 秒以内；这是数值分辨率，非真实预测精度。非常短的可见窗口可能被 10 秒扫描漏过。
- 天空图是完整圆形地平投影：北上、东右、南下、西左，中心天顶。亮点是加速轨迹演示，不是实时位置。

## 静态更新链

唯一快照为 `public/data/iss-tle.json`。浏览器内置一份作为离线回退，并以不缓存请求读取本站 JSON。坐标不上传；不直接跨域请求 CelesTrak，不需服务器或 API key。

`node --import tsx scripts/sat-pass/update-tle.ts` 从 CelesTrak 固定 ISS (25544) 官方 URL 请求 3LE，校验编号、行长、校验和、参数和真实历元。抓取时间与历元分别记录。新数据必须不超过 3 天且不倒退，原子替换文件；失败保留原件：已有快照通过同样验证且仍在 7 天有效期内时，仅警告并继续构建，抓取时间保持不变；没有有效回退才返回非零。

既有 Cloudflare Pages 部署工作流在构建前更新和测试，另加每 6 小时计划。只使用原有 contents:read 权限及已配置 Cloudflare secrets，不新增凭据或仓库写权限。计划任务从默认分支执行；更新警告或部署失败需维护者查看 Actions。GitHub 自身可能暂停不活跃仓库计划任务，浏览器不会假设计划已成功。

预测端独立从 TLE 第 1 行计算历元。超过 3 天提示偏旧；超过 7 天或历元超前超过 1 天完全停算。预测末端截在历元 +7 天以内，即使页面长期开着也每分钟重新检查。7 天是本工具的保守产品上限，不是精度保证；ISS 机动后即使新 TLE 也可能有误差。刷新失败不伪造成功，不改变历元。

2026-10-01 初次修复从官方来源取得的快照历元为 2026-09-30T20:27:19.351Z，抓取 2026-10-01T11:29:40Z。旧快照不仅超过两个半月，而且第 1 行校验和不正确，因此已移除。

## 可重复验证

- `node --import tsx --test src/scripts/astro-today/*.test.ts src/scripts/sat-pass/*.test.ts`
- `TZ=UTC node --import tsx src/scripts/astro-today/self-check.ts`
- `TZ=America/Los_Angeles node --import tsx --test src/scripts/astro-today/*.test.ts`
- `node --import tsx src/scripts/sat-pass/self-check.ts`
- `npm run lint` / `npm run build`

测试中的固定 2026-09-30 轨道样本只用于回归测试，不能替代发布快照。覆盖新月/满月/上弦/下弦、数值积分亮面面积、跨时区日界线和 DST、极昼、白昼文案、轨道编号与校验和、伪造抓取时间不延长有效期、陈旧数据拒绝、日照/地影、可见/几何区分、边界细化、正在过境和四方天空投影。

浏览器人工验收：390px 及桌面，切换时区和日期，键盘选择轨迹，拒绝定位、网络失败、过期数据、减少动态效果；确认无横向页面溢出且刷新状态可见。此轮执行环境的云浏览器访问 localhost 被限制，不能将程序性测试视为已完成视觉验收。

## 一手资料

- https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md
- https://celestrak.org/NORAD/documentation/gp-data-formats.php
- https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE
- https://www.nasa.gov/missions/station/spot-the-station-frequently-asked-questions/
