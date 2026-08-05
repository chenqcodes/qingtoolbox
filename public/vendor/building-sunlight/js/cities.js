/**
 * 城市纬度数据库
 * 包含中国主要城市及部分国际城市
 */
const DEFAULT_CHINA_TIME_ZONE = 'Asia/Shanghai';

function createCity(name, lat, lon, timeZone = DEFAULT_CHINA_TIME_ZONE) {
    return { name, lat, lon, timeZone };
}

const CITY_DATA = {
    // 中国城市 - 按区域分组
    china: {
        label: '🇨🇳 中国城市',
        cities: [
            createCity('北京', 39.90, 116.40),
            createCity('上海', 31.23, 121.47),
            createCity('广州', 23.13, 113.26),
            createCity('深圳', 22.54, 114.06),
            createCity('天津', 39.13, 117.20),
            createCity('重庆', 29.56, 106.55),
            createCity('成都', 30.57, 104.07),
            createCity('杭州', 30.27, 120.15),
            createCity('武汉', 30.58, 114.31),
            createCity('南京', 32.06, 118.80),
            createCity('西安', 34.27, 108.94),
            createCity('苏州', 31.30, 120.58),
            createCity('郑州', 34.75, 113.62),
            createCity('长沙', 28.23, 112.94),
            createCity('青岛', 36.07, 120.38),
            createCity('济南', 36.65, 117.12),
            createCity('沈阳', 41.80, 123.43),
            createCity('大连', 38.91, 121.61),
            createCity('哈尔滨', 45.75, 126.63),
            createCity('长春', 43.88, 125.32),
            createCity('厦门', 24.48, 118.09),
            createCity('福州', 26.08, 119.30),
            createCity('合肥', 31.86, 117.23),
            createCity('昆明', 25.04, 102.71),
            createCity('贵阳', 26.58, 106.63),
            createCity('南昌', 28.68, 115.86),
            createCity('南宁', 22.82, 108.32),
            createCity('石家庄', 38.04, 114.51),
            createCity('太原', 37.87, 112.55),
            createCity('兰州', 36.06, 103.84),
            createCity('西宁', 36.62, 101.78),
            createCity('银川', 38.47, 106.23),
            createCity('呼和浩特', 40.84, 111.75),
            createCity('乌鲁木齐', 43.83, 87.62),
            createCity('拉萨', 29.65, 91.11),
            createCity('海口', 20.04, 110.20),
            createCity('三亚', 18.25, 109.51),
            createCity('珠海', 22.27, 113.58),
            createCity('无锡', 31.49, 120.31),
            createCity('宁波', 29.87, 121.55),
            createCity('温州', 28.00, 120.70),
            createCity('东莞', 23.02, 113.75),
            createCity('佛山', 23.02, 113.12),
            createCity('烟台', 37.46, 121.45),
            createCity('威海', 37.51, 122.12),
            createCity('洛阳', 34.62, 112.45),
            createCity('徐州', 34.26, 117.29),
            createCity('常州', 31.79, 119.97),
            createCity('扬州', 32.39, 119.41),
            createCity('绍兴', 30.00, 120.58),
        ]
    },
    // 国际城市
    international: {
        label: '🌍 国际城市',
        cities: [
            createCity('东京', 35.68, 139.69, 'Asia/Tokyo'),
            createCity('首尔', 37.57, 126.98, 'Asia/Seoul'),
            createCity('新加坡', 1.35, 103.82, 'Asia/Singapore'),
            createCity('曼谷', 13.76, 100.50, 'Asia/Bangkok'),
            createCity('悉尼', -33.87, 151.21, 'Australia/Sydney'),
            createCity('墨尔本', -37.81, 144.96, 'Australia/Melbourne'),
            createCity('纽约', 40.71, -74.01, 'America/New_York'),
            createCity('洛杉矶', 34.05, -118.24, 'America/Los_Angeles'),
            createCity('伦敦', 51.51, -0.13, 'Europe/London'),
            createCity('巴黎', 48.86, 2.35, 'Europe/Paris'),
            createCity('柏林', 52.52, 13.40, 'Europe/Berlin'),
            createCity('迪拜', 25.20, 55.27, 'Asia/Dubai'),
            createCity('莫斯科', 55.76, 37.62, 'Europe/Moscow'),
            createCity('多伦多', 43.65, -79.38, 'America/Toronto'),
            createCity('温哥华', 49.28, -123.12, 'America/Vancouver'),
        ]
    }
};

/**
 * 获取所有城市的扁平列表
 * @returns {Array<{name: string, lat: number, lon: number, timeZone: string, group: string}>}
 */
function getAllCities() {
    const result = [];
    for (const [groupKey, group] of Object.entries(CITY_DATA)) {
        for (const city of group.cities) {
            result.push({
                name: city.name,
                lat: city.lat,
                lon: city.lon,
                timeZone: city.timeZone,
                group: group.label
            });
        }
    }
    return result;
}

/**
 * 根据城市名查找纬度
 * @param {string} cityName 
 * @returns {number|null}
 */
function getLatitudeByCity(cityName) {
    return getLocationByCity(cityName)?.lat ?? null;
}

/**
 * 根据城市名查找完整位置数据。
 */
function getLocationByCity(cityName) {
    for (const group of Object.values(CITY_DATA)) {
        const city = group.cities.find(c => c.name === cityName);
        if (city) return { ...city };
    }
    return null;
}

/**
 * 生成城市选择器的 HTML options
 * @param {string} selectedCity 当前选中的城市名
 * @returns {string} HTML字符串
 */
function generateCityOptions(selectedCity = '') {
    const placeholder = typeof i18n !== 'undefined' ? i18n.t('viewer.selectCityPlaceholder') : '-- 选择城市 --';
    let html = `<option value="">${typeof Utils !== 'undefined' ? Utils.escapeHtml(placeholder) : placeholder}</option>`;

    for (const [groupKey, group] of Object.entries(CITY_DATA)) {
        const groupLabel = typeof Utils !== 'undefined' ? Utils.escapeHtml(group.label) : group.label;
        html += `<optgroup label="${groupLabel}">`;
        for (const city of group.cities) {
            const selected = city.name === selectedCity ? 'selected' : '';
            const safeName = typeof Utils !== 'undefined' ? Utils.escapeHtml(city.name) : city.name;
            html += `<option value="${safeName}" data-lat="${city.lat}" data-lon="${city.lon}" data-time-zone="${city.timeZone}" ${selected}>${safeName} (${city.lat}°, ${city.lon}°)</option>`;
        }
        html += '</optgroup>';
    }

    return html;
}

/** 按经纬度找最近城市（粗略球面距离） */
function findNearestCity(lat, lon) {
    let best = null;
    let bestD = Infinity;
    for (const city of getAllCities()) {
        const dLat = (city.lat - lat) * Math.PI / 180;
        const dLon = (city.lon - lon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat * Math.PI / 180) * Math.cos(city.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (d < bestD) {
            bestD = d;
            best = city;
        }
    }
    return best;
}

// 导出（如果是模块环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CITY_DATA, getAllCities, getLatitudeByCity, getLocationByCity, generateCityOptions, findNearestCity };
}
