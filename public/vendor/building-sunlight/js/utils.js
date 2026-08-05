/**
 * 工具函数模块
 * Utility Functions Module
 * 
 * @description 提供通用的工具函数，避免代码重复
 * @author Building Sunlight Simulator Team
 * @version 1.0.0
 */

const Utils = (function() {
    'use strict';

    /**
     * 计算两点之间的距离
     * @param {Object} a - 点A {x, y}
     * @param {Object} b - 点B {x, y}
     * @returns {number} 距离
     */
    function distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    /**
     * 判断两点是否相等
     * @param {Object} a - 点A {x, y}
     * @param {Object} b - 点B {x, y}
     * @param {number} epsilon - 误差范围
     * @returns {boolean}
     */
    function pointsEqual(a, b, epsilon = 0) {
        if (!a || !b) return false;
        if (epsilon > 0) return distance(a, b) <= epsilon;
        return a.x === b.x && a.y === b.y;
    }

    /**
     * 限制整数值在指定范围内
     * @param {number} value - 输入值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @param {number} fallback - 无效时的默认值
     * @returns {number}
     */
    function clampInt(value, min, max, fallback) {
        if (Number.isNaN(value)) return fallback;
        return Math.min(Math.max(Math.round(value), min), max);
    }

    /**
     * 限制浮点数值在指定范围内
     * @param {number} value - 输入值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @param {number} fallback - 无效时的默认值
     * @returns {number}
     */
    function clampFloat(value, min, max, fallback) {
        if (Number.isNaN(value)) return fallback;
        return Math.min(Math.max(value, min), max);
    }

    /**
     * 保留指定小数位数
     * @param {number} value - 输入值
     * @param {number} decimals - 小数位数
     * @returns {number}
     */
    function roundTo(value, decimals = 2) {
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    }

    function stableSerialize(value) {
        const ancestors = new Set();

        function serialize(item) {
            if (item === null) return 'null';
            if (typeof item === 'number') {
                if (!Number.isFinite(item)) throw new TypeError('Cannot serialize a non-finite number');
                return Object.is(item, -0) ? '0' : JSON.stringify(item);
            }
            if (typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
            if (Array.isArray(item)) {
                if (ancestors.has(item)) throw new TypeError('Cannot serialize a circular value');
                ancestors.add(item);
                const result = `[${item.map(entry => serialize(entry === undefined ? null : entry)).join(',')}]`;
                ancestors.delete(item);
                return result;
            }
            if (typeof item === 'object') {
                if (ancestors.has(item)) throw new TypeError('Cannot serialize a circular value');
                ancestors.add(item);
                const entries = Object.keys(item)
                    .filter(key => item[key] !== undefined && typeof item[key] !== 'function')
                    .sort()
                    .map(key => `${JSON.stringify(key)}:${serialize(item[key])}`);
                ancestors.delete(item);
                return `{${entries.join(',')}}`;
            }
            throw new TypeError(`Cannot serialize value of type ${typeof item}`);
        }

        return serialize(value);
    }

    function hashString(value) {
        const source = String(value);
        let first = 0x811c9dc5;
        let second = 0x9e3779b9;
        for (let index = 0; index < source.length; index++) {
            const code = source.charCodeAt(index);
            first ^= code;
            first = Math.imul(first, 0x01000193);
            second ^= code;
            second = Math.imul(second, 0x85ebca6b);
            second ^= second >>> 13;
        }
        first ^= first >>> 16;
        second ^= second >>> 16;
        return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
    }

    function createFingerprint(value) {
        return hashString(stableSerialize(value));
    }

    /**
     * 归一化角度到 [-180, 180]
     * @param {number} angle - 输入角度
     * @returns {number}
     */
    function normalizeAngle(angle) {
        if (Number.isNaN(angle) || !Number.isFinite(angle)) return 0;
        let normalized = angle % 360;
        if (normalized > 180) normalized -= 360;
        if (normalized <= -180) normalized += 360;
        return roundTo(normalized, 2);
    }

    /**
     * 格式化时间显示
     * @param {number} hour - 小时数（可以是小数）
     * @returns {string} 格式化的时间字符串 (HH:MM)
     */
    function formatTime(hour) {
        const totalMinutes = Math.round(Number(hour) * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = ((totalMinutes % 60) + 60) % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    /**
     * 按固定区间生成中点采样时刻，避免重复计算首尾端点。
     */
    function createTimeSamples(startHour, endHour, interval) {
        const start = Number(startHour);
        const end = Number(endHour);
        const step = Number(interval);
        if (![start, end, step].every(Number.isFinite) || step <= 0 || end <= start) return [];

        const count = Math.floor(((end - start) / step) + 1e-9);
        const samples = [];
        for (let index = 0; index < count; index++) {
            samples.push(roundTo(start + (index + 0.5) * step, 10));
        }
        return samples;
    }

    function estimateOcclusionWork(raySteps, triangleCounts, referenceTriangles = 12) {
        const rays = Number(raySteps);
        const reference = Number(referenceTriangles);
        if (!Number.isFinite(rays) || rays < 0 || !Number.isFinite(reference) || reference <= 0
            || !Array.isArray(triangleCounts)) return Infinity;
        const meshEquivalents = triangleCounts.reduce((total, count) => {
            const triangles = Number(count);
            if (!Number.isFinite(triangles) || triangles < 0) return Infinity;
            return total + Math.max(1, triangles / reference);
        }, 0);
        return rays * meshEquivalents;
    }

    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} wait - 等待时间（毫秒）
     * @returns {Function}
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 节流函数
     * @param {Function} func - 要节流的函数
     * @param {number} limit - 时间限制（毫秒）
     * @returns {Function}
     */
    function throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * 深拷贝对象
     * @param {*} obj - 要拷贝的对象
     * @returns {*}
     */
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => deepClone(item));
        if (obj instanceof Object) {
            const clonedObj = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    clonedObj[key] = deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    /**
     * 计算多边形中心点
     * @param {Array} points - 点数组 [{x, y}, ...]
     * @returns {Object} 中心点 {x, y}
     */
    function getPolygonCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };
        
        let x = 0, y = 0;
        points.forEach(p => {
            x += p.x;
            y += p.y;
        });
        
        return {
            x: x / points.length,
            y: y / points.length
        };
    }

    /**
     * 计算多边形面积
     * @param {Array} points - 点数组 [{x, y}, ...]
     * @returns {number} 面积
     */
    function getPolygonArea(points) {
        if (!points || points.length < 3) return 0;
        
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        
        return Math.abs(area / 2);
    }

    function pointsNearlyEqual(a, b, epsilon = 1e-9) {
        return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
    }

    function orientation(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    function pointOnSegment(a, b, point, epsilon = 1e-9) {
        return Math.abs(orientation(a, b, point)) <= epsilon
            && point.x >= Math.min(a.x, b.x) - epsilon
            && point.x <= Math.max(a.x, b.x) + epsilon
            && point.y >= Math.min(a.y, b.y) - epsilon
            && point.y <= Math.max(a.y, b.y) + epsilon;
    }

    function segmentsIntersect(a, b, c, d, epsilon = 1e-9) {
        const o1 = orientation(a, b, c);
        const o2 = orientation(a, b, d);
        const o3 = orientation(c, d, a);
        const o4 = orientation(c, d, b);

        if (((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon))
            && ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon))) {
            return true;
        }

        return (Math.abs(o1) <= epsilon && pointOnSegment(a, b, c, epsilon))
            || (Math.abs(o2) <= epsilon && pointOnSegment(a, b, d, epsilon))
            || (Math.abs(o3) <= epsilon && pointOnSegment(c, d, a, epsilon))
            || (Math.abs(o4) <= epsilon && pointOnSegment(c, d, b, epsilon));
    }

    function polygonSelfIntersects(points) {
        if (!Array.isArray(points) || points.length < 4) return false;
        const count = points.length;

        for (let i = 0; i < count; i++) {
            const nextI = (i + 1) % count;
            for (let j = i + 1; j < count; j++) {
                const nextJ = (j + 1) % count;
                const adjacent = i === j || nextI === j || nextJ === i;
                if (adjacent) continue;
                if (segmentsIntersect(points[i], points[nextI], points[j], points[nextJ])) return true;
            }
        }
        return false;
    }

    function isValidTimeZone(timeZone) {
        if (typeof timeZone !== 'string' || !timeZone.trim()) return false;
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: timeZone.trim() }).format(new Date(0));
            return true;
        } catch (error) {
            return false;
        }
    }

    function rotatePlanPoint(point, angleDeg) {
        const radians = Number(angleDeg) * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return {
            x: point.x * cos - point.y * sin,
            y: point.x * sin + point.y * cos
        };
    }

    function transformProjectData(data, northAngle) {
        if (!data) return null;
        const normalizedAngle = normalizeAngle(Number(northAngle));
        const rotationAngle = -normalizedAngle;
        const transformed = deepClone(data);
        transformed.northAngle = normalizedAngle;
        if (!Array.isArray(transformed.buildings)) return transformed;

        transformed.buildings = transformed.buildings.map(building => {
            const nextBuilding = { ...building };
            if (Array.isArray(building.shape)) {
                nextBuilding.shape = building.shape.map(point => rotatePlanPoint(point, rotationAngle));
            }
            if (building.center && Number.isFinite(building.center.x) && Number.isFinite(building.center.y)) {
                nextBuilding.center = rotatePlanPoint(building.center, rotationAngle);
            }
            nextBuilding.unitSplitAngleDeg = normalizeAngle(
                (Number(building.unitSplitAngleDeg) || 0) + rotationAngle
            );
            return nextBuilding;
        });
        return transformed;
    }

    function normalizeBuildingData(data, options = {}) {
        const errors = [];
        const warnings = [];
        const defaults = {
            latitude: 36.65,
            longitude: 117.12,
            timeZone: 'Asia/Shanghai',
            northAngle: 0,
            scaleRatio: 1,
            ...options.defaults
        };
        const limits = {
            latitude: { min: -90, max: 90 },
            longitude: { min: -180, max: 180 },
            northAngle: { min: -180, max: 180 },
            floors: { min: 1, max: 300 },
            floorHeight: { min: 1, max: 20 },
            units: { min: 1, max: 50 },
            buildings: { min: 1, max: 500 },
            polygonPoints: { min: 3, max: 200 },
            minPolygonArea: 0.0001,
            ...options.limits
        };

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return { valid: false, errors: ['数据必须是对象'], warnings, data: null };
        }

        function readNumber(value, path, range, fallback, integer = false) {
            if (value == null) return fallback;
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                errors.push(`${path} 必须是有效数字`);
                return fallback;
            }
            if (integer && !Number.isInteger(value)) {
                errors.push(`${path} 必须是整数`);
                return fallback;
            }
            if (range && (value < range.min || value > range.max)) {
                errors.push(`${path} 须在 ${range.min} ~ ${range.max} 之间`);
                return fallback;
            }
            return value;
        }

        const latitude = readNumber(data.latitude, '纬度 latitude', limits.latitude, defaults.latitude);
        const longitude = readNumber(data.longitude, '经度 longitude', limits.longitude, defaults.longitude);
        const northAngle = normalizeAngle(readNumber(data.northAngle, '北向角 northAngle', limits.northAngle, defaults.northAngle));
        const scaleRatio = readNumber(data.scaleRatio, '比例 scaleRatio', { min: Number.EPSILON, max: Number.MAX_VALUE }, defaults.scaleRatio);
        const timeZone = data.timeZone == null ? defaults.timeZone : String(data.timeZone).trim();

        if (data.latitude == null) warnings.push('缺少纬度，已使用默认/当前值');
        if (data.longitude == null) warnings.push('缺少经度，已使用默认/当前值');
        if (data.timeZone == null) warnings.push('缺少时区，已使用默认/当前值');
        if (!isValidTimeZone(timeZone)) errors.push('时区 timeZone 须为有效 IANA 时区（如 Asia/Shanghai）');

        let origin = { x: 0, y: 0 };
        if (data.origin != null) {
            if (!data.origin || typeof data.origin !== 'object'
                || !Number.isFinite(data.origin.x) || !Number.isFinite(data.origin.y)) {
                errors.push('原点 origin 须包含有效的 x、y');
            } else {
                origin = { x: data.origin.x, y: data.origin.y };
            }
        }

        if (!Array.isArray(data.buildings)) {
            errors.push('buildings 须为楼栋数组');
            return { valid: false, errors, warnings, data: null };
        }
        if (data.buildings.length < limits.buildings.min || data.buildings.length > limits.buildings.max) {
            errors.push(`楼栋数量须在 ${limits.buildings.min} ~ ${limits.buildings.max} 栋之间`);
        }

        const buildings = [];
        data.buildings.forEach((building, index) => {
            const path = `第${index + 1}栋`;
            if (!building || typeof building !== 'object' || Array.isArray(building)) {
                errors.push(`${path} 数据格式无效`);
                return;
            }

            const floors = readNumber(building.floors, `${path}.层数`, limits.floors, 1, true);
            const floorHeight = readNumber(building.floorHeight, `${path}.层高`, limits.floorHeight, 3);
            const units = readNumber(building.units, `${path}.户数`, limits.units, 1, true);
            const maximumHeight = limits.floors.max * limits.floorHeight.max;
            const calculatedHeight = floors * floorHeight;
            const suppliedHeight = readNumber(
                building.totalHeight,
                `${path}.总高`,
                { min: Number.EPSILON, max: maximumHeight },
                calculatedHeight
            );
            if (building.totalHeight != null
                && Math.abs(suppliedHeight - calculatedHeight) > Math.max(1e-6, calculatedHeight * 1e-6)) {
                errors.push(`${path}.总高须等于 层数×层高`);
            }
            const totalHeight = calculatedHeight;

            let isThisCommunity = true;
            if (building.isThisCommunity != null) {
                if (typeof building.isThisCommunity !== 'boolean') {
                    errors.push(`${path}.isThisCommunity 须为布尔值`);
                } else {
                    isThisCommunity = building.isThisCommunity;
                }
            }

            let shape = [];
            if (!Array.isArray(building.shape)) {
                errors.push(`${path}.轮廓 shape 须为点数组`);
            } else {
                shape = building.shape.map((point, pointIndex) => {
                    if (!point || typeof point !== 'object'
                        || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                        errors.push(`${path}.轮廓点[${pointIndex}] 须包含有效 x、y`);
                        return null;
                    }
                    return { x: point.x, y: point.y };
                }).filter(Boolean);

                if (shape.length > 3 && pointsNearlyEqual(shape[0], shape[shape.length - 1])) shape.pop();
                if (shape.length < limits.polygonPoints.min || shape.length > limits.polygonPoints.max) {
                    errors.push(`${path}.轮廓点数须在 ${limits.polygonPoints.min} ~ ${limits.polygonPoints.max} 之间`);
                }
                for (let pointIndex = 0; pointIndex < shape.length; pointIndex++) {
                    if (pointsNearlyEqual(shape[pointIndex], shape[(pointIndex + 1) % shape.length])) {
                        errors.push(`${path}.轮廓含零长度边（相邻点重合）`);
                        break;
                    }
                }
                if (getPolygonArea(shape) < limits.minPolygonArea) {
                    errors.push(`${path}.轮廓面积过小`);
                }
                if (polygonSelfIntersects(shape)) {
                    errors.push(`${path}.轮廓不能自相交（边不要交叉，请沿外墙按顺序描一圈）`);
                }
            }

            let center = getPolygonCenter(shape);
            if (building.center != null) {
                if (!building.center || typeof building.center !== 'object'
                    || !Number.isFinite(building.center.x) || !Number.isFinite(building.center.y)) {
                    errors.push(`${path}.中心点须包含有效 x、y`);
                } else {
                    center = { x: building.center.x, y: building.center.y };
                }
            }

            let unitsPerFloor;
            const effectiveUnitsPerFloor = new Array(floors).fill(units);
            if (building.unitsPerFloor != null) {
                if (!Array.isArray(building.unitsPerFloor) || building.unitsPerFloor.length === 0
                    || building.unitsPerFloor.length > floors
                    || building.unitsPerFloor.some(value => !Number.isInteger(value)
                        || value < limits.units.min || value > limits.units.max)) {
                    errors.push(`${path}.unitsPerFloor 无效`);
                } else {
                    for (let floorIndex = 0; floorIndex < floors; floorIndex++) {
                        effectiveUnitsPerFloor[floorIndex] = building.unitsPerFloor[
                            Math.min(floorIndex, building.unitsPerFloor.length - 1)
                        ];
                    }
                    unitsPerFloor = effectiveUnitsPerFloor.slice();
                }
            }

            let unitRatiosPerFloor;
            if (building.unitRatiosPerFloor != null) {
                if (!Array.isArray(building.unitRatiosPerFloor)
                    || ![1, floors].includes(building.unitRatiosPerFloor.length)) {
                    errors.push(`${path}.unitRatiosPerFloor 须为 1 行或每层一行`);
                } else {
                    const sharedRow = building.unitRatiosPerFloor.length === 1;
                    if (sharedRow && effectiveUnitsPerFloor.some(value => value !== effectiveUnitsPerFloor[0])) {
                        errors.push(`${path}.各层户数不同时，unitRatiosPerFloor 不能共用一行`);
                    }
                    unitRatiosPerFloor = building.unitRatiosPerFloor.map((row, rowIndex) => {
                        if (row == null && building.unitRatiosPerFloor.length === floors) return null;
                        const expectedUnits = sharedRow ? effectiveUnitsPerFloor[0] : effectiveUnitsPerFloor[rowIndex];
                        if (!Array.isArray(row) || row.length !== expectedUnits
                            || row.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
                            errors.push(`${path}.unitRatiosPerFloor[${rowIndex}] 无效`);
                            return null;
                        }
                        const sum = row.reduce((total, value) => total + value, 0);
                        if (sum <= 1e-9) {
                            errors.push(`${path}.unitRatiosPerFloor[${rowIndex}] 比例之和须大于 0`);
                            return null;
                        }
                        return row.map(value => value / sum);
                    });
                }
            }

            const splitAngle = readNumber(
                building.unitSplitAngleDeg,
                `${path}.unitSplitAngleDeg`,
                limits.northAngle,
                0
            );
            const numberingSide = building.unitNumberingStartSide == null
                ? 'A'
                : String(building.unitNumberingStartSide).toUpperCase();
            if (!['A', 'B'].includes(numberingSide)) {
                errors.push(`${path}.unitNumberingStartSide 须为 A 或 B`);
            }

            buildings.push({
                name: typeof building.name === 'string' && building.name.trim()
                    ? building.name.trim()
                    : `Building ${index + 1}`,
                floors,
                floorHeight,
                units,
                totalHeight,
                isThisCommunity,
                shape,
                center,
                ...(unitRatiosPerFloor ? { unitRatiosPerFloor } : {}),
                ...(unitsPerFloor ? { unitsPerFloor } : {}),
                ...(Math.abs(splitAngle) > 1e-9 ? { unitSplitAngleDeg: normalizeAngle(splitAngle) } : {}),
                ...(numberingSide === 'B' ? { unitNumberingStartSide: 'B' } : {})
            });
        });

        const normalized = {
            version: data.version ?? '3.2.0',
            latitude,
            longitude,
            timeZone,
            northAngle,
            scaleRatio,
            origin,
            buildings
        };

        return { valid: errors.length === 0, errors, warnings, data: errors.length === 0 ? normalized : null };
    }

    /**
     * 验证并规范化 JSON 数据格式。
     */
    function validateBuildingData(data, options = {}) {
        const result = normalizeBuildingData(data, options);
        return { valid: result.valid, errors: result.errors, warnings: result.warnings };
    }

    /**
     * 下载文件
     * @param {string} content - 文件内容
     * @param {string} filename - 文件名
     * @param {string} mimeType - MIME 类型
     */
    function downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * 显示加载提示
     * @param {string} message - 提示信息
     * @returns {Function} 关闭函数
     */
    function showLoading(message = 'Loading...') {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px 40px;
            border-radius: 8px;
            font-size: 16px;
        `;
        content.textContent = message;
        
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        
        return function close() {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };
    }

    function parseDateParts(date) {
        if (typeof date === 'string') {
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
            if (!match) return null;
            const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
            const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
            if (check.getUTCFullYear() !== parts.year
                || check.getUTCMonth() + 1 !== parts.month
                || check.getUTCDate() !== parts.day) return null;
            return parts;
        }
        if (date instanceof Date && Number.isFinite(date.getTime())) {
            return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
        }
        return null;
    }

    /**
     * 计算一年中的第几天，使用 UTC 日历差避免本地时区和夏令时误差。
     */
    function getDayOfYear(date) {
        const parts = parseDateParts(date);
        if (!parts) return NaN;
        const current = Date.UTC(parts.year, parts.month - 1, parts.day);
        const start = Date.UTC(parts.year, 0, 0);
        return Math.round((current - start) / 86400000);
    }

    /**
     * 根据日期计算太阳赤纬角
     * @param {Date|string} date - 日期对象或日期字符串 (YYYY-MM-DD)
     * @returns {number} 太阳赤纬角（度）
     * @description 使用简化公式：δ = 23.45° × sin(360° × (284 + N) / 365)
     */
    function calculateSolarDeclination(date) {
        const dayOfYear = getDayOfYear(date);
        if (!Number.isFinite(dayOfYear)) return NaN;
        
        // 简化的太阳赤纬角计算公式
        // δ = 23.45° × sin(360° × (284 + N) / 365)
        // 其中 N 是一年中的第几天
        const angle = 360 * (284 + dayOfYear) / 365;
        const declination = 23.45 * Math.sin(angle * Math.PI / 180);
        
        return roundTo(declination, 2);
    }

    /**
     * NOAA 近似公式计算均时差（分钟）。
     */
    function calculateEquationOfTime(date) {
        const dayOfYear = getDayOfYear(date);
        if (!Number.isFinite(dayOfYear)) return NaN;
        const gamma = (2 * Math.PI / 365) * (dayOfYear - 1);
        return 229.18 * (
            0.000075
            + 0.001868 * Math.cos(gamma)
            - 0.032077 * Math.sin(gamma)
            - 0.014615 * Math.cos(2 * gamma)
            - 0.040849 * Math.sin(2 * gamma)
        );
    }

    /**
     * 获取指定日期中午的 IANA 时区 UTC 偏移（分钟，东正西负）。
     */
    function getTimeZoneOffsetMinutes(date, timeZone) {
        const parts = parseDateParts(date);
        if (!parts || !isValidTimeZone(timeZone)) return NaN;
        const utcNoon = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0);
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        });
        const values = {};
        formatter.formatToParts(new Date(utcNoon)).forEach(part => {
            if (part.type !== 'literal') values[part.type] = Number(part.value);
        });
        const representedAsUtc = Date.UTC(
            values.year,
            values.month - 1,
            values.day,
            values.hour,
            values.minute,
            values.second
        );
        return Math.round((representedAsUtc - utcNoon) / 60000);
    }

    /**
     * 当地民用时间转换为真太阳时所需的小时偏移。
     */
    function calculateSolarTimeOffset(date, longitude, timeZone) {
        const lon = Number(longitude);
        const utcOffsetMinutes = getTimeZoneOffsetMinutes(date, timeZone);
        const equationOfTimeMinutes = calculateEquationOfTime(date);
        if (![lon, utcOffsetMinutes, equationOfTimeMinutes].every(Number.isFinite)) return NaN;
        return (4 * lon - utcOffsetMinutes + equationOfTimeMinutes) / 60;
    }

    const SEASON_PRESET_MONTH_DAYS = {
        'march-equinox': '03-20',
        'june-solstice': '06-21',
        'september-equinox': '09-23',
        'december-solstice': '12-22'
    };

    function getSeasonPresetDate(preset, year = new Date().getFullYear()) {
        const monthDay = SEASON_PRESET_MONTH_DAYS[preset];
        return monthDay ? `${year}-${monthDay}` : null;
    }

    function getSeasonTranslationKey(preset, latitude) {
        const southern = Number(latitude) < 0;
        const northernKeys = {
            'march-equinox': 'springEquinox',
            'june-solstice': 'summerSolstice',
            'september-equinox': 'autumnEquinox',
            'december-solstice': 'winterSolstice'
        };
        const southernKeys = {
            'march-equinox': 'autumnEquinox',
            'june-solstice': 'winterSolstice',
            'september-equinox': 'springEquinox',
            'december-solstice': 'summerSolstice'
        };
        return (southern ? southernKeys : northernKeys)[preset] || null;
    }

    /**
     * 格式化日期为 YYYY-MM-DD
     * @param {Date} date - 日期对象
     * @returns {string} 格式化的日期字符串
     */
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 获取当前年份的节气日期
     * @param {string} solarTerm - 节气类型 ('winter'|'spring'|'autumn'|'summer')
     * @returns {string} 日期字符串 YYYY-MM-DD
     */
    function getSolarTermDate(solarTerm) {
        const year = new Date().getFullYear();
        const dates = {
            'winter': getSeasonPresetDate('december-solstice', year),
            'spring': getSeasonPresetDate('march-equinox', year),
            'autumn': getSeasonPresetDate('september-equinox', year),
            'summer': getSeasonPresetDate('june-solstice', year)
        };
        return dates[solarTerm] || dates.winter;
    }

    /**
     * HTML 转义，防止 XSS
     * @param {string} str - 原始字符串
     * @returns {string} 转义后的安全字符串
     */
    function escapeHtml(str) {
        const s = String(str ?? '');
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 公开 API
    return {
        distance,
        pointsEqual,
        clampInt,
        clampFloat,
        roundTo,
        stableSerialize,
        hashString,
        createFingerprint,
        normalizeAngle,
        formatTime,
        createTimeSamples,
        estimateOcclusionWork,
        debounce,
        throttle,
        deepClone,
        rotatePlanPoint,
        transformProjectData,
        getPolygonCenter,
        getPolygonArea,
        polygonSelfIntersects,
        isValidTimeZone,
        normalizeBuildingData,
        validateBuildingData,
        downloadFile,
        showLoading,
        parseDateParts,
        getDayOfYear,
        calculateSolarDeclination,
        calculateEquationOfTime,
        getTimeZoneOffsetMinutes,
        calculateSolarTimeOffset,
        getSeasonPresetDate,
        getSeasonTranslationKey,
        formatDate,
        getSolarTermDate,
        escapeHtml
    };
})();

// 兼容 CommonJS 模块系统
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
