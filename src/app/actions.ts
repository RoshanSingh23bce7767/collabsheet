"use server";

import { adminDb } from "@/lib/firebase-admin";
import { getServerUser } from "@/lib/firebase-admin-helper";
import { revalidatePath } from "next/cache";

export interface ActionResponse<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export async function createDocument(title: string): Promise<ActionResponse<{ id: string }>> {
  const user = await getServerUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!adminDb) {
    return { success: false, error: "Database not initialized on server" };
  }

  try {
    const docRef = await adminDb.collection("documents").add({
      title: title || "Untitled Spreadsheet",
      ownerId: user.uid,
      ownerName: user.name,
      lastModified: new Date(),
    });

    revalidatePath("/");
    return { success: true, data: { id: docRef.id } };
  } catch (error: unknown) {
    console.error("Failed to create document:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function renameDocument(docId: string, title: string): Promise<ActionResponse> {
  const user = await getServerUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!adminDb) {
    return { success: false, error: "Database not initialized on server" };
  }

  try {
    const docRef = adminDb.collection("documents").doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: "Document not found" };
    }

    const data = docSnap.data();
    if (data?.ownerId !== user.uid) {
      return { success: false, error: "Forbidden: You do not own this document" };
    }

    await docRef.update({
      title: title || "Untitled Spreadsheet",
      lastModified: new Date(),
    });

    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to rename document:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function deleteDocument(docId: string): Promise<ActionResponse> {
  const user = await getServerUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!adminDb) {
    return { success: false, error: "Database not initialized on server" };
  }

  try {
    const docRef = adminDb.collection("documents").doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: "Document not found" };
    }

    const data = docSnap.data();
    if (data?.ownerId !== user.uid) {
      return { success: false, error: "Forbidden: You do not own this document" };
    }

    // Delete cells subcollection in a batch
    const cellsRef = docRef.collection("cells");
    const cellsSnap = await cellsRef.get();
    
    const batch = adminDb.batch();
    cellsSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Delete parent document
    batch.delete(docRef);
    await batch.commit();

    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to delete document:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
