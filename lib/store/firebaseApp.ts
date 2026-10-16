import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Database, getDatabase } from "firebase/database";
import { firebaseConfig } from "./config";

// One app/database instance for the whole page - auth and every store share it.
let cachedApp: FirebaseApp | undefined;
let cachedDb: Database | undefined;

export function getFirebaseApp(): FirebaseApp {
  cachedApp ??= getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

export function getFirebaseDatabase(): Database {
  cachedDb ??= getDatabase(getFirebaseApp());
  return cachedDb;
}
