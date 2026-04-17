// src/hooks/useLocalStorageListener.js
import { useEffect } from "react";

export default function useLocalStorageListener(key, callback) {
  useEffect(() => {
    function handleStorage(event) {
      if (event.key === key) {
        callback();
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, callback]);
}

