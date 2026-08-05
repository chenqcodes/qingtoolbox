/**
 * 站内桥接：规划配置缓存 / 模拟器项目缓存
 * 与轻工具箱入口页约定同一 key
 */
window.QING_BS = {
    PROJECT_KEY: 'qingtoolbox_bs_project',
    DRAFT_DB: 'qingtoolbox_bs_db',
    DRAFT_STORE: 'editor_draft',
    /** 投稿/联系邮箱（可改） */
    SHARE_EMAIL: 'tools@cqzzz.top',

    saveProject(data) {
        try {
            localStorage.setItem(this.PROJECT_KEY, JSON.stringify({
                savedAt: Date.now(),
                data
            }));
            return true;
        } catch (e) {
            console.warn('saveProject failed', e);
            return false;
        }
    },

    loadProject() {
        try {
            const raw = localStorage.getItem(this.PROJECT_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed?.data || null;
        } catch {
            return null;
        }
    },

    openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DRAFT_DB, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(this.DRAFT_STORE)) {
                    db.createObjectStore(this.DRAFT_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async saveDraft(draft) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.DRAFT_STORE, 'readwrite');
            tx.objectStore(this.DRAFT_STORE).put({ ...draft, savedAt: Date.now() }, 'current');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },

    async loadDraft() {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.DRAFT_STORE, 'readonly');
            const req = tx.objectStore(this.DRAFT_STORE).get('current');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }
};
