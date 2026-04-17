// src/pages/RecommendPreview.jsx

import React, { useState } from "react";
import InputForm from "../components/InputForm";
import { recommend, generateReport } from "../api/api";
import PdfPreview from "../components/PdfPreview";

export default function RecommendPreview() {
  const [result, setResult] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [err, setErr] = useState(null);

  async function onRecommend(input) {
    try {
      setErr(null);
      const res = await recommend(input);
      setResult(res);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function onPDF() {
    try {
      const blob = await generateReport(result.predictions);
      setPdfBlob(blob);
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <>
      <h2>Recommendation</h2>
      <InputForm submitLabel="Get Recommendation" onSubmit={onRecommend} />
      {err && <div className="error">{err}</div>}

      {result && (
        <div className="card">
          <h3>Results</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
          <button onClick={onPDF}>Generate PDF</button>
        </div>
      )}

      <PdfPreview blob={pdfBlob} />
    </>
  );
}
