import DashboardClient, { DashboardDoc } from "@/components/DashboardClient";
import { adminDb } from "@/lib/firebase-admin";

export const revalidate = 0; // Disable static cache for real-time responsiveness

export default async function DashboardPage() {
  let documents: DashboardDoc[] = [];
  const isDbConfigured = !!adminDb;

  if (adminDb) {
    try {
      const snap = await adminDb
        .collection("documents")
        .orderBy("lastModified", "desc")
        .get();

      documents = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || "Untitled Spreadsheet",
          ownerId: data.ownerId || "",
          ownerName: data.ownerName || "Anonymous Creator",
          lastModified: data.lastModified?.toDate()
            ? data.lastModified.toDate().toLocaleString()
            : new Date().toLocaleString(),
        };
      });
    } catch (err) {
      console.error("Failed to fetch documents from adminDb:", err);
    }
  } else {
    // Safe mock fallbacks for local build/testing environment before configuring firebase keys
    documents = [
      {
        id: "demo-sheet-1",
        title: "Project Revenue Forecast (Demo)",
        ownerId: "demo-owner",
        ownerName: "Sarah Jenkins",
        lastModified: "2 hours ago",
      },
      {
        id: "demo-sheet-2",
        title: "Sprint Planning Tracker",
        ownerId: "demo-owner-2",
        ownerName: "Marcus Vance",
        lastModified: "Yesterday at 4:15 PM",
      },
    ];
  }

  return <DashboardClient initialDocs={documents} isDbConfigured={isDbConfigured} />;
}
