/**
 * 国际化 (i18n) 语言配置模块
 * Internationalization (i18n) Language Configuration Module
 * 
 * @description 提供中英文双语支持，自动检测浏览器语言，支持语言切换和持久化存储
 * @author Building Sunlight Simulator Team
 * @version 1.0.0
 */

const i18n = (function () {
    'use strict';

    // 私有变量
    let currentLang = 'zh';
    const STORAGE_KEY = 'buildingSunlight_lang';

    // 语言包配置
    const translations = {
        zh: {
            // 通用
            common: {
                north: '北',
                loading: '加载中',
                confirm: '确认',
                cancel: '取消',
                delete: '删除',
                save: '保存',
                export: '导出',
                import: '导入',
                close: '关闭',
                expand: '展开'
            },

            // 查看器 (index.html)
            viewer: {
                title: '楼盘采光可视化 - 日照模拟系统',
                emptyState: '请导入 JSON，或点「新规划配置」描楼',
                pageTitle: '☀️ 楼盘采光模拟',

                // 状态块
                statusLabel: '当前状态',
                statusCoord: '坐标对齐规划图',
                statusOrientation: '方位：',
                statusNorth: '↑ 上北下南',
                orientationNorthUp: '图纸向上为北',
                orientationClockwise: '图纸正北顺时针偏转 {0}°',
                orientationCounterClockwise: '图纸正北逆时针偏转 {0}°',

                // 控制面板
                step1: '1. 导入或新建',
                selectJson: '📂 导入 JSON',
                newPlan: '✏️ 新规划配置',
                shareHint: '导入与规划配置共用同一套 JSON。好友互传：下载 JSON 发给对方，对方点「导入 JSON」即可打开。',
                copyShare: '复制分享说明',
                mailShare: '发邮件给站点',
                shareCopied: '分享说明已复制',
                shareMailSubject: '【楼盘日照】投稿小区配置 JSON',
                shareMailBody: '你好，附件是我用轻工具箱楼盘日照导出的 buildings_config.json，希望可作示例收录。\\n小区名称/城市：\\n说明：\\n',
                shareText: '【轻工具箱·楼盘日照】配置可互传：\\n1. 打开 https://tools.cqzzz.top/building-sunlight/\\n2. 用「导入 JSON」加载对方发来的 buildings_config.json\\n3. 或点「新规划配置」自己描楼后下载 JSON 分享\\n投稿示例可发至 {0}',
                dropJsonHint: '松开以导入项目 JSON',
                importLoading: '正在加载项目...',

                step2: '2. 项目位置',
                selectCity: '选择城市',
                inputLatitude: '手动输入纬度',
                inputLongitude: '手动输入经度',
                inputTimeZone: 'IANA 时区',
                northAngle: '北向角(度)',
                northAngleLabel: '北向角',
                northAngleHint: '相对图纸向上，顺时针为正；修改后会重新校正模型与日照。',
                currentLat: '当前',
                northLat: '北纬',
                southLat: '南纬',

                step3: '3. 选择日期',
                winterSolstice: '冬至',
                springEquinox: '春分',
                autumnEquinox: '秋分',
                summerSolstice: '夏至',
                customDate: '自定义日期',
                selectDate: '选择日期',

                displayRange: '显示范围',
                ownOnly: '只显示本小区',

                timeLabel: '当地民用时间 (06:00 - 18:00)',

                // 日照分析
                step4: '4. 日照分析',
                calcButton: '🔬 计算日照时长',
                calculating: '计算中...',
                showHeatmap: '显示日照热力图',
                referenceHours: '参考时长（小时）',
                exportAnalysisButton: '⇩ 导出项目与结果',
                precomputedReady: '已缓存 {0} 个可复用分析结果',
                precomputedApplied: '已使用项目内的预计算结果',
                precomputedIgnored: '项目中的预计算结果与当前模型不匹配，已忽略',
                exportAnalysisComplete: '项目与预计算结果已导出',

                // 热力图图例
                legendHours: ['0h', '4h', '8h'],

                // 提示
                tip: '💡 提示: 拖动查看阴影变化',

                // 统计信息
                analysisDate: '分析日期',
                statsScope: '统计口径',
                statsScopeUnitMax: '累计离散受光时段；按户取同一户各外墙采样片段中的最大值',
                statsTotalUnits: '总户数',
                statsAverageHours: '平均日照',
                statsMinHours: '最低日照',
                statsMaxHours: '最高日照',
                statsBelowReference: '低于参考值户数',
                statsCurrentFocus: '当前焦点',
                statsCurrentUnit: '当前户',
                statsCurrentBuilding: '所属楼栋',
                statsBuildingAverage: '楼栋平均',
                statsBuildingBelowReference: '楼栋低于参考值',
                statsNoSelection: '悬停或点击热力图可查看当前户和楼栋统计',
                statsStatusLabel: '状态',

                // 户型信息面板
                unitInfo: '户型信息',
                floor: '楼层',
                floorUnit: '层',
                unitNumber: '户号',
                unitFrom: '第',
                unitTo: '户(从东向西)',
                sunlightDuration: '日照时长',
                sunlightHours: '小时',
                sunlightStatus: '参考值状态',
                statusReachedReference: '达到参考值',
                statusBelowReference: '低于参考值',
                analysisDisclaimer: '本结果用于方案可视化估算，不代表任何地区的法规合规结论；检测日期、检测点及连续时长要求请按当地规则复核。',

                // 错误提示
                errorNoData: '请先导入建筑数据',
                errorNoBuilding: '没有找到本小区的建筑（isThisCommunity: true）',
                errorParseFailed: 'JSON 解析失败，请检查文件格式',
                errorInvalidData: '建筑数据无效：\n{0}',
                errorInvalidLocation: '经纬度或 IANA 时区无效',
                errorTooComplex: '模型过于复杂，采样点或计算步数超过安全上限',
                errorCalcFailed: '计算过程中出错，请重试',
                errorFileRead: '文件读取失败，请重试',
                errorInvalidJsonFile: '请选择或拖入 JSON 文件',
                errorExportFailed: '导出项目结果失败，请重试',

                // 计算进度
                calculatingProgress: '计算中... {0}%',
                calculationComplete: '计算完成！',
                calculationCancelled: '计算已取消',
                cancelCalculation: '取消计算',

                // 城市选择器
                selectCityPlaceholder: '-- 选择城市 --',

                // 默认楼名
                defaultBuildingName: '{0}号楼'
            },

            // 编辑器 (editor.html)
            editor: {
                title: '楼盘规划图配置器',
                emptyTip: '请在右侧上传图片开始规划',
                pageTitle: '🛠️ 楼盘数据配置',

                // 步骤1
                step1Title: '1. 准备底图或继续旧项目',
                step1Hint: '支持拖拽、缩放、绘制多边形表示楼栋轮廓。',
                uploadImageTitle: '上传规划图 / 总平图',
                uploadImageDesc: '新项目从这里开始：选一张小区俯视图，后面在上面描楼栋。',
                importJsonTitle: '导入项目 JSON',
                importJsonDesc: '已有导出的楼栋配置时用：恢复楼栋与位置（底图可另传，或点「恢复草稿」）。',
                importProjectButton: '导入项目 JSON',
                cacheTitle: '浏览器草稿',
                cacheDesc: '含底图与描线，刷新后可继续；与「下载 JSON」互不冲突。',
                loadDraft: '恢复草稿',
                saveDraft: '保存草稿',
                draftSaved: '草稿已保存',
                draftLoaded: '草稿已恢复',
                draftEmpty: '暂无草稿',
                draftFailed: '草稿读写失败（可能图片过大）',
                wizard1: '底图',
                wizard2: '比例',
                wizard3: '描楼',
                wizard4: '参数',
                wizard5: '导出',
                wizardHint1: '当前：上传小区总平面图（鸟瞰/规划图）作为描楼底板。',
                wizardHint2: '当前：在图上点两点并填真实距离，标定比例尺。',
                wizardHint3: '当前：切换到绘制模式，沿楼栋轮廓描点并完成。',
                wizardHint4: '当前：确认城市/经纬度与默认层高、户数。',
                wizardHint5: '当前：检查楼栋表，下载 JSON 或写入模拟器缓存。',
                step2Hint: '在图上点两点（如已知楼间距），再填真实米数，后面距离才准。',
                exportHint: '下载 JSON 可备份；「写入缓存」后回日照页会自动加载。',
                exportButton: '下载 JSON',
                cacheToViewer: '写入缓存并去模拟',
                cacheOk: '已写入模拟器缓存',
                geoLocating: '正在定位城市…',
                geoOk: '已按定位匹配：{0}',
                geoFail: '定位不可用，已用默认城市',
                importLoading: '正在加载项目...',
                dragDropLabel: '拖入图片更换底图；拖入 JSON 继续编辑项目',

                // 步骤2
                step2Title: '2. 标定比例尺',
                scaleStatus: '状态',
                scaleNotSet: '未标定',
                scaleSet: '已标定',
                startScale: '开始标定 (点击两点)',
                scalePrompt: '请在图中点击两点',
                realDistance: '两点间实际距离 (米):',
                confirmScale: '确认比例',

                // 步骤3
                step3Title: '3. 绘制楼栋',
                step3Hint: '🖱️ 滚轮缩放，按住中键或空格拖拽视图',
                step3Operation: '操作: 左键加点，左键双击结束；右键撤销上个点。',
                modeIdle: '当前: ✋ 浏览模式',
                modeDrawing: '当前: ✏️ 正在绘制 (双击结束 / 右键撤销)',
                undoPoint: '↶ 撤销点',
                undoEdit: '↶ 撤销编辑',
                finishPolygon: '✓ 完成轮廓',
                resetView: '⟲ 重置视角',

                // 步骤4
                step4Title: '4. 全局参数 & 默认值',
                projectLocation: '📍 项目位置（用于日照计算）',
                selectCity: '选择城市',
                orInputLat: '或输入纬度',
                orInputLon: '或输入经度',
                timeZone: 'IANA 时区',
                northAngle: '北向角(度)',
                northAngleHint: '相对图纸向上，顺时针为正；0° 表示上北下南。',
                defaultParams: '新楼栋默认参数:',
                defaultFloors: '默认层数',
                defaultFloorHeight: '默认层高(米)',
                defaultUnits: '默认户数/层',
                defaultIsOwn: '默认标记为本小区',
                defaultUnitNumberingStartFromSideB: '默认户号从B侧开始',
                useDefaults: '新楼栋使用默认值',
                applyToAll: '应用到所有楼栋',

                // 步骤5
                step5Title: '5. 楼栋参数表（统一填写/编辑）',

                // 表格
                tableName: '名称（可编辑）',
                tableFloors: '层数',
                tableFloorHeight: '层高(米)',
                tableUnits: '户/层',
                tableIsOwn: '本小区',
                tableActions: '操作',
                tableDelete: '删除',
                tableVisualSplit: '可视化编辑',
                namePlaceholder: '输入名称（如：1号楼/配建/幼儿园）',
                splitConfigTitle: '分户配置',
                splitAngle: '分户轴角度',
                splitNumberingStartSide: '户号起始侧',
                splitNumberingSideA: 'A侧优先',
                splitNumberingSideB: 'B侧优先',
                splitRatios: '分户比例',
                splitRatiosPlaceholder: '留空表示按户数等分；填 1 行表示整栋复用；填多行表示逐层覆盖',
                splitRatiosHelp: '每行按逗号分隔，值个数需等于户/层。',
                splitRatiosExamples: '示例：1,1,1,1 或 2,3',
                alertInvalidSplitConfig: '楼栋“{0}”的分户配置无效：{1}',
                splitRatiosErrorLineCount: '分户比例需填写 1 行或与层数一致',
                splitRatiosErrorValueCount: '每行分户比例数量必须等于户/层',
                splitRatiosErrorNumber: '分户比例必须为非负数字，且总和大于 0',
                visualSplitTitle: '可视化分户',
                visualSplitFloor: '楼层',
                visualSplitFloorOption: '第 {0} 层',
                visualSplitUnitRatio: '第 {0} 户 (%)',
                visualSplitEqualize: '当前层等分',
                visualSplitApplyAll: '应用到全部楼层',

                // 提示信息
                alertNoScale: '请先标定比例尺！',
                alertMinPoints: '至少需要三个点才能闭合楼栋。',
                alertInvalidPoly: '绘制的多边形无效，请重画。',
                alertNoData: '没有数据可导出',
                alertInvalidDistance: '请输入正确的实际距离，并确保两点不重合。',
                alertConfirmDelete: '确定删除该楼栋吗？',
                alertConfirmReplaceImage: '加载新底图会清除当前楼栋、比例尺和未完成轮廓，是否继续？',
                alertConfirmReplaceProject: '导入项目会替换当前楼栋、比例尺和未完成轮廓，是否继续？',
                alertInvalidLocation: '请输入有效的经度、纬度和 IANA 时区。',
                alertInvalidDropFile: '不支持的文件类型，请拖入 JSON 或图片文件。',
                alertImportProjectFailed: '项目导入失败，请检查 JSON 数据。',

                // 缩放信息
                zoomInfo: '缩放'
            }
        },

        en: {
            // Common
            common: {
                north: 'N',
                loading: 'Loading',
                confirm: 'Confirm',
                cancel: 'Cancel',
                delete: 'Delete',
                save: 'Save',
                export: 'Export',
                import: 'Import',
                close: 'Close',
                expand: 'Expand'
            },

            // Viewer (index.html)
            viewer: {
                title: 'Building Sunlight Visualization - Sunlight Simulation System',
                emptyState: 'Import JSON, or tap New plan setup to trace buildings',
                pageTitle: '☀️ Building Sunlight Simulation',

                // Status block
                statusLabel: 'Current Status',
                statusCoord: 'Coordinates aligned with plan',
                statusOrientation: 'Orientation:',
                statusNorth: '↑ North Up',
                orientationNorthUp: 'Plan up is north',
                orientationClockwise: 'Plan north is rotated {0}° clockwise',
                orientationCounterClockwise: 'Plan north is rotated {0}° counterclockwise',

                // Control panel
                step1: '1. Import or create',
                selectJson: '📂 Import JSON',
                newPlan: '✏️ New plan setup',
                shareHint: 'Import and plan editor share the same JSON. Send the file to a friend; they import it to open the project.',
                copyShare: 'Copy share tips',
                mailShare: 'Email the site',
                shareCopied: 'Share tips copied',
                shareMailSubject: '[Building Sunlight] Submit community JSON',
                shareMailBody: 'Hi, attached is buildings_config.json from Qing Toolbox. Please consider adding it as a sample.\\nCommunity / city:\\nNotes:\\n',
                shareText: '[Qing Toolbox · Building Sunlight] Share a project:\\n1. Open https://tools.cqzzz.top/building-sunlight/\\n2. Use Import JSON with buildings_config.json\\n3. Or create a plan, download JSON, and send it\\nSubmit samples to {0}',
                dropJsonHint: 'Drop to import the project JSON',
                importLoading: 'Loading project...',

                step2: '2. Project Location',
                selectCity: 'Select City',
                inputLatitude: 'Manual Input Latitude',
                inputLongitude: 'Manual Input Longitude',
                inputTimeZone: 'IANA Time Zone',
                northAngle: 'North Angle (deg)',
                northAngleLabel: 'North Angle',
                northAngleHint: 'Relative to plan up, clockwise is positive. Changes will realign geometry and sunlight.',
                currentLat: 'Current',
                northLat: 'N',
                southLat: 'S',

                step3: '3. Select Date',
                winterSolstice: 'Winter Solstice',
                springEquinox: 'Spring Equinox',
                autumnEquinox: 'Autumn Equinox',
                summerSolstice: 'Summer Solstice',
                customDate: 'Custom Date',
                selectDate: 'Select Date',

                displayRange: 'Display Range',
                ownOnly: 'Show Only This Community',

                timeLabel: 'Local Civil Time (06:00 - 18:00)',

                // Sunlight analysis
                step4: '4. Sunlight Analysis',
                calcButton: '🔬 Calculate Sunlight Duration',
                calculating: 'Calculating...',
                showHeatmap: 'Show Sunlight Heatmap',
                referenceHours: 'Reference Duration (hours)',
                exportAnalysisButton: '⇩ Export Project and Results',
                precomputedReady: '{0} reusable analysis result(s) cached',
                precomputedApplied: 'Using a precomputed result from this project',
                precomputedIgnored: 'Precomputed results do not match the current model and were ignored',
                exportAnalysisComplete: 'Project and precomputed results exported',

                // Heatmap legend
                legendHours: ['0h', '4h', '8h'],

                // Tips
                tip: '💡 Tip: Drag to view shadow changes',

                // Statistics
                analysisDate: 'Analysis Date',
                statsScope: 'Statistic Scope',
                statsScopeUnitMax: 'Cumulative discrete exposure; each apartment uses the maximum among its exterior-facade sample segments',
                statsTotalUnits: 'Total Apartments',
                statsAverageHours: 'Average Sunlight',
                statsMinHours: 'Minimum Sunlight',
                statsMaxHours: 'Maximum Sunlight',
                statsBelowReference: 'Apartments Below Reference',
                statsCurrentFocus: 'Current Focus',
                statsCurrentUnit: 'Current Apartment',
                statsCurrentBuilding: 'Building',
                statsBuildingAverage: 'Building Average',
                statsBuildingBelowReference: 'Building Below Reference',
                statsNoSelection: 'Hover or click a heatmap cell to inspect the focused apartment and building summary',
                statsStatusLabel: 'Status',

                // Unit info panel
                unitInfo: 'Unit Information',
                floor: 'Floor',
                floorUnit: 'F',
                unitNumber: 'Unit Number',
                unitFrom: 'Unit',
                unitTo: '(West to East)',
                sunlightDuration: 'Sunlight Duration',
                sunlightHours: 'hours',
                sunlightStatus: 'Reference Status',
                statusReachedReference: 'Meets Reference',
                statusBelowReference: 'Below Reference',
                analysisDisclaimer: 'This is a planning visualization estimate, not a regulatory compliance conclusion. Verify local rules for dates, test points, and continuous-duration requirements.',

                // Error messages
                errorNoData: 'Please import building data first',
                errorNoBuilding: 'No buildings found in this community (isThisCommunity: true)',
                errorParseFailed: 'JSON parsing failed, please check file format',
                errorInvalidData: 'Invalid building data:\n{0}',
                errorInvalidLocation: 'Invalid coordinates or IANA time zone',
                errorTooComplex: 'The model exceeds the safe sampling or calculation limit',
                errorCalcFailed: 'Error during calculation, please try again',
                errorFileRead: 'File read failed, please try again',
                errorInvalidJsonFile: 'Select or drop a JSON file',
                errorExportFailed: 'Failed to export project results',

                // Calculation progress
                calculatingProgress: 'Calculating... {0}%',
                calculationComplete: 'Calculation complete!',
                calculationCancelled: 'Calculation cancelled',
                cancelCalculation: 'Cancel calculation',

                // City selector
                selectCityPlaceholder: '-- Select City --',

                // Default building name
                defaultBuildingName: 'Building {0}'
            },

            // Editor (editor.html)
            editor: {
                title: 'Building Plan Configurator',
                emptyTip: 'Please upload an image on the right to start planning',
                pageTitle: '🛠️ Building Data Configuration',

                // Step 1
                step1Title: '1. Prepare basemap or resume project',
                step1Hint: 'Supports drag, zoom, and draw polygons to represent building outlines.',
                uploadImageTitle: 'Upload plan / site plan',
                uploadImageDesc: 'Start here: pick a top-down community image to trace buildings on.',
                importJsonTitle: 'Import project JSON',
                importJsonDesc: 'Restore exported buildings. Re-upload basemap or restore browser draft for the image.',
                importProjectButton: 'Import Project JSON',
                cacheTitle: 'Browser draft',
                cacheDesc: 'Includes basemap and traces. Survives refresh. Independent from JSON download.',
                loadDraft: 'Restore draft',
                saveDraft: 'Save draft',
                draftSaved: 'Draft saved',
                draftLoaded: 'Draft restored',
                draftEmpty: 'No draft yet',
                draftFailed: 'Draft I/O failed (image may be too large)',
                wizard1: 'Map',
                wizard2: 'Scale',
                wizard3: 'Trace',
                wizard4: 'Params',
                wizard5: 'Export',
                wizardHint1: 'Now: upload a community plan image as the tracing basemap.',
                wizardHint2: 'Now: click two points and enter real meters to set scale.',
                wizardHint3: 'Now: enter draw mode and trace building outlines.',
                wizardHint4: 'Now: confirm city / coordinates and default floors.',
                wizardHint5: 'Now: review the table, download JSON or cache for the viewer.',
                step2Hint: 'Click two known points (e.g. building spacing) then enter real meters.',
                exportHint: 'Download JSON to backup. Caching auto-loads on the sunlight page.',
                exportButton: 'Download JSON',
                cacheToViewer: 'Cache & open viewer',
                cacheOk: 'Cached for the viewer',
                geoLocating: 'Detecting city…',
                geoOk: 'Matched by location: {0}',
                geoFail: 'Location unavailable, using default city',
                importLoading: 'Loading project...',
                dragDropLabel: 'Drop an image to replace the plan; drop JSON to continue editing a project',

                // Step 2
                step2Title: '2. Calibrate Scale',
                scaleStatus: 'Status',
                scaleNotSet: 'Not Calibrated',
                scaleSet: 'Calibrated',
                startScale: 'Start Calibration (Click Two Points)',
                scalePrompt: 'Please click two points on the image',
                realDistance: 'Actual Distance Between Two Points (meters):',
                confirmScale: 'Confirm Scale',

                // Step 3
                step3Title: '3. Draw Buildings',
                step3Hint: '🖱️ Scroll to zoom, hold middle button or space to drag view',
                step3Operation: 'Operation: Left click to add point, double-click to finish; right click to undo last point.',
                modeIdle: 'Current: ✋ Browse Mode',
                modeDrawing: 'Current: ✏️ Drawing (Double-click to finish / Right-click to undo)',
                undoPoint: '↶ Undo Point',
                undoEdit: '↶ Undo Edit',
                finishPolygon: '✓ Finish Outline',
                resetView: '⟲ Reset View',

                // Step 4
                step4Title: '4. Global Parameters & Defaults',
                projectLocation: '📍 Project Location (for sunlight calculation)',
                selectCity: 'Select City',
                orInputLat: 'Or Input Latitude',
                orInputLon: 'Or Input Longitude',
                timeZone: 'IANA Time Zone',
                northAngle: 'North Angle (deg)',
                northAngleHint: 'Relative to plan up, clockwise is positive; 0° means north-up.',
                defaultParams: 'Default Parameters for New Buildings:',
                defaultFloors: 'Default Floors',
                defaultFloorHeight: 'Default Floor Height (m)',
                defaultUnits: 'Default Units/Floor',
                defaultIsOwn: 'Mark as This Community by Default',
                defaultUnitNumberingStartFromSideB: 'Default numbering starts from side B',
                useDefaults: 'Use Defaults for New Buildings',
                applyToAll: 'Apply to All Buildings',

                // Step 5
                step5Title: '5. Building Parameters Table (Unified Editing)',

                // Table
                tableName: 'Name (Editable)',
                tableFloors: 'Floors',
                tableFloorHeight: 'Floor Height (m)',
                tableUnits: 'Units/Floor',
                tableIsOwn: 'This Community',
                tableActions: 'Actions',
                tableDelete: 'Delete',
                tableVisualSplit: 'Visual Editor',
                namePlaceholder: 'Enter name (e.g., Building 1/Ancillary/Kindergarten)',
                splitConfigTitle: 'Unit Split',
                splitAngle: 'Split Axis Angle',
                splitNumberingStartSide: 'Numbering Starts From',
                splitNumberingSideA: 'Side A First',
                splitNumberingSideB: 'Side B First',
                splitRatios: 'Split Ratios',
                splitRatiosPlaceholder: 'Blank = equal split; 1 line = reuse for all floors; multiple lines = per-floor override',
                splitRatiosHelp: 'Use comma-separated values. Each line must contain Units/Floor values.',
                splitRatiosExamples: 'Example: 1,1,1,1 or 2,3',
                alertInvalidSplitConfig: 'Invalid unit split config for "{0}": {1}',
                splitRatiosErrorLineCount: 'Split ratios must contain either 1 line or exactly one line per floor',
                splitRatiosErrorValueCount: 'Each split-ratio line must contain exactly Units/Floor values',
                splitRatiosErrorNumber: 'Split ratios must be non-negative numbers with a positive sum',
                visualSplitTitle: 'Visual Unit Split',
                visualSplitFloor: 'Floor',
                visualSplitFloorOption: 'Floor {0}',
                visualSplitUnitRatio: 'Unit {0} (%)',
                visualSplitEqualize: 'Equalize Current Floor',
                visualSplitApplyAll: 'Apply to All Floors',

                // Alert messages
                alertNoScale: 'Please calibrate the scale first!',
                alertMinPoints: 'At least three points are required to close the building.',
                alertInvalidPoly: 'The drawn polygon is invalid, please redraw.',
                alertNoData: 'No data to export',
                alertInvalidDistance: 'Please enter a valid actual distance and ensure the two points are not coincident.',
                alertConfirmDelete: 'Are you sure you want to delete this building?',
                alertConfirmReplaceImage: 'Loading a new plan will clear buildings, scale calibration, and the unfinished outline. Continue?',
                alertConfirmReplaceProject: 'Importing a project will replace buildings, scale calibration, and the unfinished outline. Continue?',
                alertInvalidLocation: 'Enter valid coordinates and an IANA time zone.',
                alertInvalidDropFile: 'Unsupported file type. Drop a JSON or image file.',
                alertImportProjectFailed: 'Project import failed. Check the JSON data.',

                // Zoom info
                zoomInfo: 'Zoom'
            }
        }
    };

    /**
     * 初始化语言设置
     * 优先级: localStorage > 浏览器语言 > 默认中文
     */
    function init() {
        // 从 localStorage 读取用户偏好
        const savedLang = localStorage.getItem(STORAGE_KEY);
        if (savedLang && translations[savedLang]) {
            currentLang = savedLang;
            return;
        }

        // 根据浏览器语言自动选择
        const browserLang = navigator.language || navigator.userLanguage;
        currentLang = browserLang.startsWith('zh') ? 'zh' : 'en';
    }

    /**
     * 切换语言
     * @param {string} lang - 语言代码 ('zh' | 'en')
     * @returns {boolean} 是否切换成功
     */
    function setLanguage(lang) {
        if (!translations[lang]) {
            console.warn(`Language '${lang}' not supported`);
            return false;
        }

        currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);
        return true;
    }

    /**
     * 获取翻译文本
     * @param {string} key - 翻译键，支持点号分隔的路径 (如 'viewer.pageTitle')
     * @returns {string} 翻译后的文本，如果找不到则返回 key 本身
     */
    function t(key) {
        const keys = key.split('.');
        let value = translations[currentLang];

        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                console.warn(`Translation key '${key}' not found`);
                return key;
            }
        }

        return value !== undefined ? value : key;
    }

    /**
     * 获取当前语言
     * @returns {string} 当前语言代码
     */
    function getCurrentLanguage() {
        return currentLang;
    }

    /**
     * 获取所有支持的语言
     * @returns {string[]} 支持的语言代码数组
     */
    function getSupportedLanguages() {
        return Object.keys(translations);
    }

    // 自动初始化
    init();

    // 公开 API
    return {
        t,
        setLanguage,
        getCurrentLanguage,
        getSupportedLanguages
    };
})();

// 兼容旧版本的直接访问方式（可选）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = i18n;
}
