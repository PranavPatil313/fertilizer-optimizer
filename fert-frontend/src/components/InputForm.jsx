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

  // Group fields by category for better organization
  const fieldGroups = {
    "Crop Details": ["crop_type", "soil_type", "region", "crop_duration_days"],
    "Climate": ["avg_temp", "rainfall_mm", "irrigation_type"],
    "Soil Properties": ["soil_N", "soil_P", "soil_K", "pH", "organic_matter_pct"],
    "Field Area": ["area_acre"]
  };

  const getFieldLabel = (key) => {
    const labels = {
      crop_type: "Crop Type",
      soil_type: "Soil Type",
      region: "Region",
      avg_temp: "Avg Temperature (°C)",
      rainfall_mm: "Rainfall (mm)",
      crop_duration_days: "Crop Duration (days)",
      soil_N: "Soil N (mg/kg)",
      soil_P: "Soil P (mg/kg)",
      soil_K: "Soil K (mg/kg)",
      pH: "Soil pH",
      organic_matter_pct: "Organic Matter (%)",
      irrigation_type: "Irrigation Type",
      area_acre: "Area (acres)"
    };
    return labels[key] || key;
  };

  return (
    <form onSubmit={submit} className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {Object.entries(fieldGroups).map(([groupName, fields]) => (
          <div key={groupName} className="space-y-4">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 px-1 pb-2 border-b border-slate-200">
              {groupName}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {fields.map((key) => (
                <div key={key} className="flex flex-col">
                  <label className="text-xs sm:text-sm font-medium text-slate-700 mb-2 block">
                    {getFieldLabel(key)}
                  </label>
                  <input
                    type={typeof form[key] === 'number' ? 'number' : 'text'}
                    name={key}
                    value={form[key]}
                    onChange={update}
                    step={typeof form[key] === 'number' ? "0.1" : undefined}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg border border-slate-200 text-sm sm:text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition min-h-touch placeholder-slate-400"
                    placeholder={getFieldLabel(key)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-4 sm:pt-6 border-t border-slate-200">
          <button
            type="submit"
            className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg sm:rounded-full transition min-h-touch flex items-center justify-center shadow-md hover:shadow-lg text-sm sm:text-base"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}