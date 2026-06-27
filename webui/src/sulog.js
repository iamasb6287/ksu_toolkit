import { spawn, listPackages, getPackagesInfo } from 'kernelsu-alt';
import { modDir, bin, appendSuLogList } from './index.js';

let appList = [], sulogList = [], sulogOld = [], upTime = 0;
const symbolMap = {
    'a': ['access'],
    's': ['stat'],
    'x': ['exec'],
    'i': ['ioctl'],
    '$': ['access', 'stat']
};

async function getAppList() {
    try {
        const pacakegs = await listPackages();
        const pkgInfos = await getPackagesInfo(pacakegs);
        pkgInfos.forEach(pkg => {
            appList.push({
                packageName: pkg.packageName,
                appLabel: pkg.appLabel,
                uid: pkg.uid
            });
        });
    } catch (e) {
        // Vite 调试
        if (import.meta.env.DEV) {
            appList = [
                { packageName: "com.android.example", appLabel: "示例", uid: 10008 },
            ];
        }
    }

}

function getSulog() {
    let copy = [];
    const result = spawn(`${bin}`, ['--sulog'], { env: { PATH: `${modDir}` }});
    result.stdout.on('data', (data) => {
        if (data.trim().includes('uptime')) {
            upTime = parseInt(data.trim().split(' ')[1]);
            return;
        }
        // 输出格式 = sym: i uid: 010230 time: 0000000154
        const symbol = data.trim().split(' ')[1];
        const userId = parseInt(data.trim().split(' ')[3]);
        const timeStamp = data.trim().split(' ')[5] ? parseInt(data.trim().split(' ')[5]) : 0;
        copy.push({ uid: userId, sym: symbol, time: timeStamp });
    });
    result.on('exit', () => {
        if (import.meta.env.DEV) { // Vite 调试
            upTime = 800;
            copy.push({ uid: 10008, sym: '$', time: 20 });
        }

        // 由于 sulog 最多输出 250 行，我们需要比较重叠长度
        let overlap = 0;
        const maxLen = Math.min(sulogOld.length, copy.length);
        for (let len = maxLen; len >= 0; len--) {
            const suffix = sulogOld.slice(sulogOld.length - len);
            const prefix = copy.slice(0, len);
            if (JSON.stringify(suffix) === JSON.stringify(prefix)) {
                overlap = len;
                break;
            }
        }

        const newItems = copy.slice(overlap);
        sulogList.push(...newItems);
        if (newItems.length > 0) {
            const currentDate = Date.now();
            appendSuLogList(newItems, currentDate);
        }
        sulogOld = [...copy];
    });
}

function parseSymbol(sym) {
    return symbolMap[sym] || [sym];
}

export { appList, sulogList, upTime, symbolMap, getAppList, getSulog, parseSymbol };
