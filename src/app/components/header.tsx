"use client";
import { JSX, useEffect, useState } from "react";
import { applyTheme, getSavedTheme, toggleTheme } from "../utils/theme";

export function Header(): JSX.Element {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    applyTheme(getSavedTheme());
  }, []);

  useEffect(() => {
    setTheme(getSavedTheme());
  }, []);

  return (
    <div>
      Header
      <button
        className="bg-blue-500 text-white p-2 rounded-md"
        onClick={() => setTheme(toggleTheme())}
      >
        Switch to {theme === "dark" ? "light" : "dark"} mode
      </button>
    </div>
  );
}
