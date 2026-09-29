import CryptoJS from 'crypto-js';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { firestore } from './auth';

// Since it's a client-side app, we'll generate a consistent key based on the user's UID to make it seamless.

export interface BackupMetadata {
  id: string;
  userId: string;
  date: string;
  time: string;
  appVersion: string;
  dbVersion: string;
  deviceName: string;
  os: string;
  size: number;
  compressionRatio: number;
  encryptionVersion: string;
  hash: string;
  status: string;
  type: 'Full' | 'Incremental';
}

export class BackupService {
  private userId: string;
  private encryptionKey: string;

  constructor(userId: string) {
    this.userId = userId;
    // For seamless UX, use the user's ID combined with a secret salt to derive an encryption key
    this.encryptionKey = CryptoJS.SHA256(`smartacc_secret_${userId}`).toString();
  }

  private encryptData(data: string): string {
    return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
  }

  private decryptData(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  private calculateHash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  private getDeviceAndOS() {
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    if (ua.indexOf('Win') !== -1) os = 'Windows';
    if (ua.indexOf('Mac') !== -1) os = 'MacOS';
    if (ua.indexOf('Linux') !== -1) os = 'Linux';
    if (ua.indexOf('Android') !== -1) os = 'Android';
    if (ua.indexOf('like Mac') !== -1) os = 'iOS';
    return {
      deviceName: navigator.platform || 'Unknown Device',
      os
    };
  }

  async uploadBackup(dbState: any, type: 'Full' | 'Incremental' = 'Full'): Promise<BackupMetadata> {
    console.log("Uploading backup for user:", this.userId);
    const rawData = JSON.stringify(dbState);
    const encryptedData = this.encryptData(rawData);
    console.log("Encrypted data size:", encryptedData.length, "bytes");
    const hash = this.calculateHash(encryptedData);
    
    const { deviceName, os } = this.getDeviceAndOS();
    const now = new Date();
    
    const metadata: BackupMetadata = {
      id: `backup_${now.getTime()}`,
      userId: this.userId,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      appVersion: '1.0.0',
      dbVersion: '1.0',
      deviceName,
      os,
      size: encryptedData.length,
      compressionRatio: 1, // Simplified for now
      encryptionVersion: 'AES-256',
      hash,
      status: 'success',
      type
    };

    try {
      const backupDocRef = doc(firestore, 'user_backups', this.userId, 'backups_store', metadata.id);
      console.log("Attempting to write document to:", backupDocRef.path);
      await setDoc(backupDocRef, {
        id: metadata.id,
        userId: this.userId,
        metadata,
        encryptedData,
        createdAt: now.toISOString()
      });
      console.log("Backup upload successful.");
      return metadata;
    } catch (err: any) {
      console.error("Backup upload error for user:", this.userId, err);
      // Detailed error logging
      const errorMessage = err.message || err.toString() || 'Unknown error';
      const errorCode = err.code || 'unknown_code';
      const errorDetails = err.details || 'No additional details';
      
      console.error(`Error details: Code=${errorCode}, Message=${errorMessage}, Details=${errorDetails}`);
      
      throw new Error(`فشل رفع النسخة الاحتياطية إلى السحابة: ${errorMessage} (Code: ${errorCode})`);
    }
  }

  async listBackups(): Promise<{ driveId: string, metadata: BackupMetadata }[]> {
    console.log("Listing backups for user:", this.userId);
    try {
      const colRef = collection(firestore, 'user_backups', this.userId, 'backups_store');
      const snapshot = await getDocs(colRef);
      
      const backups = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          driveId: docSnap.id,
          metadata: data.metadata as BackupMetadata
        };
      });
      
      return backups.sort((a, b) => new Date(`${b.metadata.date}T${b.metadata.time}`).getTime() - new Date(`${a.metadata.date}T${a.metadata.time}`).getTime());
    } catch (err: any) {
      console.error("Backup list error for user:", this.userId, err);
      // Detailed error logging
      const errorMessage = err.message || err.toString() || 'Unknown error';
      const errorCode = err.code || 'unknown_code';
      const errorDetails = err.details || 'No additional details';
      
      console.error(`Error details: Code=${errorCode}, Message=${errorMessage}, Details=${errorDetails}`);
      
      throw new Error(`فشل جلب قائمة النسخ الاحتياطية: ${errorMessage} (Code: ${errorCode})`);
    }
  }

  async downloadBackup(driveId: string): Promise<any> {
    try {
      const docRef = doc(firestore, 'user_backups', this.userId, 'backups_store', driveId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("النسخة الاحتياطية المطلوبة غير موجودة");
      }
      const data = docSnap.data();
      const decryptedStr = this.decryptData(data.encryptedData);
      return JSON.parse(decryptedStr);
    } catch (e: any) {
      console.error(e);
      throw new Error("فشل تحميل أو فك تشفير النسخة الاحتياطية (تالفة أو مفتاح خاطئ)");
    }
  }

  async deleteBackup(driveId: string): Promise<void> {
    try {
      const docRef = doc(firestore, 'user_backups', this.userId, 'backups_store', driveId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error(err);
      throw new Error("فشل حذف النسخة الاحتياطية");
    }
  }
}
