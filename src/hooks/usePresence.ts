import { useEffect, useState } from "react";
import { ref as rtdbRef, set, onValue, onDisconnect, remove } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export interface Collaborator {
  uid: string;
  name: string;
  color: string;
  activeCell: string;
  lastSeen: number;
}

export function usePresence(docId: string, user: { uid: string; name: string; color: string } | null) {
  const isDummyKey =
    !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "AIzaSyDummyKeyForBuildAndTesting";
  const [collaborators, setCollaborators] = useState<Record<string, Collaborator>>({});
  const [isOfflinePresence, setIsOfflinePresence] = useState(isDummyKey);

  useEffect(() => {
    if (!user || !docId || isOfflinePresence) return;

    const myPresenceRef = rtdbRef(rtdb!, `presence/${docId}/${user.uid}`);
    const presenceCollectionRef = rtdbRef(rtdb!, `presence/${docId}`);

    const updateMyPresence = async (activeCell: string = "") => {
      try {
        await set(myPresenceRef, {
          name: user.name,
          color: user.color,
          activeCell,
          lastSeen: Date.now(),
        });
      } catch (err) {
        console.warn("RTDB presence set error:", err);
      }
    };

    // Set initial presence
    updateMyPresence("");

    // Setup onDisconnect cleanup
    const disconnectRef = onDisconnect(myPresenceRef);
    disconnectRef.remove().catch((err) => {
      console.warn("RTDB onDisconnect registration failed:", err);
    });

    // Listen to all collaborators
    const unsubscribe = onValue(
      presenceCollectionRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() as Record<string, Omit<Collaborator, "uid">>;
          const list: Record<string, Collaborator> = {};
          
          Object.entries(data).forEach(([uid, val]) => {
            if (uid !== user.uid) {
              list[uid] = {
                uid,
                ...val,
              };
            }
          });
          setCollaborators(list);
        } else {
          setCollaborators({});
        }
      },
      (error) => {
        console.warn("RTDB presence listening error, using offline simulation:", error);
        setIsOfflinePresence(true);
      }
    );

    return () => {
      // Clean up my presence on unmount
      remove(myPresenceRef).catch(() => {});
      unsubscribe();
    };
  }, [docId, user, isOfflinePresence]);

  // Simulated collaborator for offline/sandbox mode to showcase presence features
  useEffect(() => {
    if (!isOfflinePresence) return;

    // Wait a couple of seconds before the bot joins the document
    const joinTimeout = setTimeout(() => {
      setCollaborators({
        "gemini-assistant-bot": {
          uid: "gemini-assistant-bot",
          name: "Gemini AI Helper 🤖",
          color: "#8B5CF6", // Violet
          activeCell: "B3",
          lastSeen: Date.now(),
        },
      });
    }, 3000);

    const positions = ["B3", "C3", "C4", "B4", "A4", "A3", "B3", "D3", "D4"];
    let index = 0;

    const moveInterval = setInterval(() => {
      setCollaborators((prev) => {
        if (!prev["gemini-assistant-bot"]) return prev;
        index = (index + 1) % positions.length;
        return {
          ...prev,
          "gemini-assistant-bot": {
            ...prev["gemini-assistant-bot"],
            activeCell: positions[index],
            lastSeen: Date.now(),
          },
        };
      });
    }, 7000);

    return () => {
      clearTimeout(joinTimeout);
      clearInterval(moveInterval);
    };
  }, [isOfflinePresence]);

  // Function to let the editor update the active cell cursor position
  const updateActiveCell = async (cellId: string) => {
    if (isOfflinePresence || !user || !docId) return;
    try {
      const myPresenceRef = rtdbRef(rtdb!, `presence/${docId}/${user.uid}`);
      await set(myPresenceRef, {
        name: user.name,
        color: user.color,
        activeCell: cellId,
        lastSeen: Date.now(),
      });
    } catch (err) {
      console.warn("RTDB activeCell update failed:", err);
    }
  };

  return { collaborators, updateActiveCell, isOfflinePresence };
}
