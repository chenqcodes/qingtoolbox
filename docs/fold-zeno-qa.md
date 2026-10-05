# 折纸、追龟与轻工具箱视觉更新

## 范围

- 新增 `/tools/paper-fold/` 与 `/tools/zeno-race/`，归入“可视化与模拟”，进入首页搜索、工具切换和站点地图
- 首页使用暖白纸面、清晰的文字层级、柔和分类配色、左侧分类直达与紧凑搜索；窄屏保持两列工具卡、换行分类链接
- 共享页头、跳过导航链接、工具标题与普通输入面板做轻量统一；保留原工具地址、功能和独立实验场景样式
- 未改动既有太阳系实现、Make 项目、部署流程或依赖版本

## 数学与视觉口径

### 折纸

- 厚度为 `初始毫米数 / 1000 × 2^n` 米。n 限定 0–80，纸张初厚 0.01–1 mm；层数使用 BigInt 精确显示
- 生活参照为设定的 1.7m 身高和 10m 房屋高；地球采用赤道直径 12,756km，太阳直径约 1,391,400km
- “太阳系尺度”定义为海王星轨道的近似直径 60AU，不冒充太阳系边界。1AU=149,597,870,700m
- 纸叠竖直厚度与参照物高度/直径共用比例尺；纸宽、纹理、轨道点大小示意，过渡动画不代表实际分数次折叠
- 纸张可无限延展、无压缩/间隙是思想实验假设；不将七折说成普适极限，也不声称现实可折80次

### 追龟

- 两者匀速、同向。默认 L=10m、a=10m/s、b=1m/s，相遇 t*=10/9s，位置100/9m；1.2s时12m对11.2m，兔子领先0.8m
- 当0<b<a，截图n的用时和位置来自几何级数；每个有限编号都在相遇之前。没有“最后一张有限编号截图”，并不阻止完整连续时钟经过极限时刻
- 截图展示节奏与模型用时明确区分，兔子本身没有按帧停步。页面不借用“最小时间量子”作为证明
- 单独处理领先0、龟速0、兔速0、等速及兔子更慢。浮点数无法继续区分时停止细分，保留正余量和分辨率说明，不声称完成无限步
- 参数更改、重置、模式切换、页面隐藏中止旧动画；连续播放可跨过相遇线，支持直接查看相遇和1.2s

## 主要来源

- NASA/JPL 太阳系尺寸参考表：https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf
- NASA 地球：https://science.nasa.gov/earth/facts/
- NASA 海王星：https://science.nasa.gov/neptune/neptune-facts/
- NASA 太阳系范围：https://science.nasa.gov/solar-system/solar-system-facts/
- University of Pittsburgh, Zeno：https://sites.pitt.edu/~jdnorton/teaching/paradox/chapters/Zeno/Zeno.html
- Cornell Mathematics, geometric series：https://pi.math.cornell.edu/~mec/Summer2009/ABjorndahl/tools.html

## 验证

- 新增纯数学单测已接入 `npm run test:science`
- 新增 Playwright 用例覆盖两页的边界、暂停/重启/中断、参数变化、手机尺寸、键盘和减少动态；附桌面/手机截图
- 目录回归新增分类直达清空搜索、手机无横向溢出、普通Base64工具仍可用及切换菜单Esc行为
- 本次云端 shell 的系统 Chromium 在加载页面前被运行环境拒绝创建 socket（EPERM），本地浏览器用例不算通过；以 GitHub Actions 对本提交的浏览器结果为准
- 纯源代码检查、数学单测与静态构建不能代替画面视觉验收。正式合并前应检查浏览器截图或已验证的分支预览
