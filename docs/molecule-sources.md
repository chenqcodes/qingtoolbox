# 分子数据来源与校验

这组数据用于分子查看器的球棍、线框与空间填充展示。小分子的原子、化学键和三维坐标均从 PubChem 读取，没有手工拼接或猜测结构。适合看连接关系、比较不同分子的骨架；不用于实验结构分析、药物设计或医疗判断。

## 数据快照

获取日期：2026-10-01（UTC）。取各 CID 的默认 **计算三维构象**，保留全部氢原子。

| 分子 | PubChem CID | 分子式 | 全部原子 | 非氢原子 | 氢原子 | 键连接数 | 双键数 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 水 | [962](https://pubchem.ncbi.nlm.nih.gov/compound/962) | H₂O | 3 | 1 | 2 | 2 | 0 |
| 咖啡因 | [2519](https://pubchem.ncbi.nlm.nih.gov/compound/2519) | C₈H₁₀N₄O₂ | 24 | 14 | 10 | 25 | 4 |
| 多巴胺 | [681](https://pubchem.ncbi.nlm.nih.gov/compound/681) | C₈H₁₁NO₂ | 22 | 11 | 11 | 22 | 3 |
| 5-羟色胺（血清素） | [5202](https://pubchem.ncbi.nlm.nih.gov/compound/5202) | C₁₀H₁₂N₂O | 25 | 13 | 12 | 26 | 4 |

“键连接数”按相连的原子对计数，一根双键也只算一个连接。四个记录的净电荷都是 0；不要把这里的中性结构当作任意 pH 或生理环境中的唯一存在形式。

## 文件与字段

可直接导入的文件位于 `src/scripts/molecule/data/`：

- `water.json`
- `caffeine.json`
- `dopamine.json`
- `serotonin.json`

字段含义：

- `atoms`：`aid` 是原始 PubChem 原子编号；`el` 是元素符号；`x/y/z` 保留原始数值，单位为 Å
- `bonds`：`a/b` 是本文件 `atoms` 数组的 **零起始下标**；`order` 是原始整数键级（本组数据只有 1、2）
- `formula`：PubChem 分子式，使用便于比对的 ASCII 数字
- `atomCount`、`heavyAtomCount`、`hydrogenCount`、`bondCount`：完整模型的数量，不是当前屏幕可见数量
- `omittedHydrogenCount`：固定为 0，原始导出没有省略氢
- `elementCounts`：由显式原子列表重新统计
- `source`：来源页面、精确请求 URL、获取日期、构象 ID、坐标类别和单位，以及原始响应的 SHA-256

例如，咖啡因的第 0 个原子对应 PubChem `aid=1`。渲染时应通过 `atoms[bond.a]` 和 `atoms[bond.b]` 找到端点，不能把 `aid` 直接当作数组下标。

`raw/` 保存四个未改写的三维 JSON 响应、单独的属性响应，以及原始坐标类型枚举的相关摘录。它们供离线核对，不需要导入客户端。

## 原始接口与复现

三维结构接口：

- [水的完整 JSON](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/962/record/JSON?record_type=3d)
- [咖啡因的完整 JSON](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2519/record/JSON?record_type=3d)
- [多巴胺的完整 JSON](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/681/record/JSON?record_type=3d)
- [5-羟色胺的完整 JSON](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/5202/record/JSON?record_type=3d)

分子式、非氢原子数和净电荷另行通过 [PubChem 属性接口](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/962,2519,681,5202/property/MolecularFormula,HeavyAtomCount,Charge/JSON) 交叉核对。

导出过程：读取 `PC_Compounds[0]`；按 `atoms.aid` 与 `coords[0].aid` 对齐原子；使用 `coords[0].conformers[0]`；将元素原子序数转换为元素符号；把原始 `bonds.aid1/aid2` 映射为零起始下标，并保留 `bonds.order`。坐标没有缩放、优化、补氢或重新布局。

四个响应的坐标类型均包含 2、5、10。[PubChem 官方 ASN.1 规范](https://ftp.ncbi.nlm.nih.gov/pubchem/specifications/pubchem.asn) 将它们分别定义为三维、计算所得、单位 Å；可据此判断来源，而不是因为文件有 `z` 字段就声称是实验三维结构。[PUG REST 文档](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest) 说明 `record_type=3d` 用于请求三维记录。

PubChem 可能在未来更新数据；新下载的响应不一定与本快照哈希相同。应一起更新来源日期、原始响应、导出数据及校验结果，不能只换坐标。

## 已完成的离线校验

- 四个返回 CID 与请求一致，原子编号唯一、坐标覆盖所有原子，数值均有限
- 原子列表的元素计数可重建来源分子式，非氢原子数同时符合原始记录和属性接口
- 所有键端点有效，没有自连接或重复连接
- 逐原子键级和符合本组中性分子的通常价态：H 为 1、C 为 4、N 为 3、O 为 2
- 所有连接的端点距离处于 0.7–1.8 Å 的宽松异常筛查范围；这只是数据损坏检查，不是结构精度认证
- 原始响应 SHA-256 已写入各导出文件

| 分子 | 最短连接距离（Å） | 最长连接距离（Å） | 构象 ID |
| --- | ---: | ---: | --- |
| 水 | 0.9690 | 0.9690 | `000003C200000001` |
| 咖啡因 | 1.0816 | 1.4593 | `000009D700000001` |
| 多巴胺 | 0.9726 | 1.5354 | `000002A900000001` |
| 5-羟色胺 | 0.9726 | 1.5398 | `0000145200000001` |

距离根据本快照的坐标计算后保留四位小数。

## 展示规则与局限

1. 建议默认显示全部氢。若提供“隐藏氢”开关，只过滤显示，不改原始数组；过滤后的键仅保留两端都可见的连接，并正确重建索引或使用原始索引。不要只显示部分氢却标成完整分子。
2. 隐藏氢时说明“为便于看清骨架，已隐藏氢原子”，并显示隐藏数量。例：咖啡因隐藏 10 个 H 后显示 14 个非氢原子，完整分子仍有 24 个原子。水建议保留 H，否则画面只剩一个 O。
3. 双键应有不同于单键的可见表现。芳香体系在这些记录中使用交替单、双键的形式；不要把线条当作真实电子密度或宣称芳香电子固定在某一条键上。
4. 这些是 PubChem 的计算构象，每个分子只取一个，并非晶体结构、实验观测或动态轨迹。[PubChem3D 方法论文](https://pmc.ncbi.nlm.nih.gov/articles/PMC3042967/) 描述了理论构象的生成；同一分子可以有多种构象，柔性侧链尤其如此。
5. 水的本快照 H–O–H 角约为 **103.98°**。不要直接把这个画面标注成精确的 104.5° 实验值，也不要悄悄把坐标改成另一种几何后仍称为原始 PubChem 坐标。
6. 原子球半径、键杆粗细、颜色和“空间填充”外观属于显示约定。除非明确采用并注明物理半径来源，否则不能把它们当成真实原子尺寸或可测量尺度。
7. 这里的数据只覆盖上述四个小分子；DNA 展示另属示意模型，不能借用这份来源声明暗示其也来自 PubChem 实测结构。

## 使用与署名

建议页面署名：“结构数据：PubChem；计算三维构象，仅供学习与可视化。数据快照：2026-10-01。”各分子名旁链接到对应 CID。

[NCBI 使用政策](https://www.ncbi.nlm.nih.gov/home/about/policies/) 说明美国政府创建的信息可自由复制传播，并请求保留适当署名；也明确提醒 PubChem 含有第三方贡献、可能另受版权条款约束的内容。因此，本项目只提取这些记录的结构连接、计算坐标与核对属性，没有复制供应商说明、文献正文、图片、实验注释或商业数据库条目，也没有为“整个 PubChem”宣称统一 CC0 或其他许可证。新增第三方内容时须另行检查其来源和条款。[PubChem 来源目录](https://pubchem.ncbi.nlm.nih.gov/sources) 可帮助追溯第三方来源。

相关项目规范：[内容规范](./content-guidelines.md)。本说明负责数据溯源，页面仍应提供具体操作示例及相关工具链接。
