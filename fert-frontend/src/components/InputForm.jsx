// src/components/InputForm.jsx

import React, { useState } from "react";

export default function InputForm({ onSubmit, submitLabel }) {
  const [form, setForm] = useState({
    crop_type: "",
    soil_type: "",
    region: "",
    avg_temp: 25,
    rainfall_mm: 0,
    crop_duration_days: 90,
    soil_N: 0,
    soil_P: 0,
    soil_K: 0,
    pH: 6.5,
    organic_matter_pct: 1.2,
    irrigation_type: "",
    area_acre: 2.5
  });

  function update(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: isNaN(value) ? value : Number(value) }));
  }

  function submit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={submit} className="card container">
      {Object.keys(form).map(key => (
        <div key={key}>
          <label>{key}</label>
          <input name={key} value={form[key]} onChange={update} />
        </div>
      ))}
      <button>{submitLabel}</button>
    </form>
  );
}