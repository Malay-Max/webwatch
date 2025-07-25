import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc, query, where, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { Website, TelegramSettings } from "./types";

const WEBSITES_COLLECTION = 'websites';
const SETTINGS_DOC = 'telegram_settings';

// Websites
export const getWebsites = async (): Promise<Website[]> => {
    const querySnapshot = await getDocs(collection(db, WEBSITES_COLLECTION));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Website));
};

export const getWebsite = async (id: string): Promise<Website | null> => {
    const docRef = doc(db, WEBSITES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Website;
    } else {
        return null;
    }
}

export const getWebsitesToMonitor = async (now: Date): Promise<Website[]> => {
    // This will fetch all websites, and the flow will decide which ones to process.
    // This is simpler and ensures new/inactive websites are picked up.
    const querySnapshot = await getDocs(collection(db, WEBSITES_COLLECTION));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Website));
}

export const addWebsite = async (website: Omit<Website, 'id'>) => {
    const docRef = await addDoc(collection(db, WEBSITES_COLLECTION), website);
    return docRef.id;
};

export const updateWebsite = async (id: string, website: Partial<Website>) => {
    const docRef = doc(db, WEBSITES_COLLECTION, id);
    await updateDoc(docRef, website);
};

export const deleteWebsite = async (id: string) => {
    const docRef = doc(db, WEBSITES_COLLECTION, id);
    await deleteDoc(docRef);
};


// Settings
export const saveTelegramSettings = async (settings: TelegramSettings) => {
    const docRef = doc(db, 'settings', SETTINGS_DOC);
    await setDoc(docRef, settings);
};

export const getTelegramSettings = async (): Promise<TelegramSettings | null> => {
    const docRef = doc(db, 'settings', SETTINGS_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docSnap.data() as TelegramSettings;
    } else {
        return null;
    }
};
