import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase-admin";
import { getServerUser } from "@/lib/firebase-admin-helper";
import Editor from "./Editor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 0; // Ensure fresh metadata is fetched on page load

export default async function DocumentPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getServerUser();

  // If the user isn't logged in, redirect to the login overlay on the dashboard
  if (!user) {
    redirect("/");
  }

  let docTitle = "Sandbox Collabsheet";
  const isDbConfigured = !!adminDb;

  if (adminDb) {
    try {
      const docSnap = await adminDb.collection("documents").doc(id).get();
      if (!docSnap.exists) {
        redirect("/");
      }
      docTitle = docSnap.data()?.title || "Untitled Spreadsheet";
    } catch (err) {
      console.error("Failed to load document metadata:", err);
    }
  } else {
    // If testing in sandbox, check if we're requesting a mock sheet
    if (id === "demo-sheet-1") {
      docTitle = "Project Revenue Forecast (Demo)";
    } else if (id === "demo-sheet-2") {
      docTitle = "Sprint Planning Tracker";
    }
  }

  return (
    <Editor docId={id} docTitle={docTitle} isDbConfigured={isDbConfigured} />
  );
}
