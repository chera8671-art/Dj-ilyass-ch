const dbPromise = indexedDB.open('BetoNukeDB', 1);
dbPromise.onupgradeneeded = (e) => {
    const db = e.target.result;
    db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
};

function saveTrack(blob, name) {
    const open = indexedDB.open('BetoNukeDB');
    open.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('tracks', 'readwrite');
        tx.objectStore('tracks').add({ blob, name, date: Date.now() });
    };
}

function loadAllTracks(callback) {
    const open = indexedDB.open('BetoNukeDB');
    open.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('tracks', 'readonly');
        const req = tx.objectStore('tracks').getAll();
        req.onsuccess = () => callback(req.result);
    };
}
