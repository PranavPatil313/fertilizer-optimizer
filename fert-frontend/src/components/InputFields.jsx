//src/components/InputFields.jsx

export default function InputField({label, ...props}) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input className="w-full border p-2 rounded" {...props} />
    </div>
  );
}