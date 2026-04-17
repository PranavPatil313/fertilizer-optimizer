// src/components/PdfPreview.jsx

import React from "react";

export default function PdfPreview({ blob }) {
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  return (
    <div className="card">
      <a href={url} target="_blank">Open PDF</a>
    </div>
  );
}