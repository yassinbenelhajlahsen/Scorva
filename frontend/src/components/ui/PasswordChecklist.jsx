// eslint-disable-next-line react-refresh/only-export-components
export function passwordMeetsRequirements(pw) {
  return (
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[0-9]/.test(pw)
  );
}

const checks = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "One number", test: (pw) => /[0-9]/.test(pw) },
];

export function PasswordChecklist({ password }) {
  if (!password) return null;
  return (
    <ul className="flex flex-col gap-1 px-1 pt-0.5">
      {checks.map(({ label, test }) => {
        const ok = test(password);
        return (
          <li key={label} className={`flex items-center gap-1.5 text-[11px] transition-colors duration-150 ${ok ? "text-win" : "text-text-tertiary"}`}>
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
              {ok ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
              ) : (
                <circle cx="6" cy="6" r="4" strokeWidth={1.5} />
              )}
            </svg>
            {label}
          </li>
        );
      })}
    </ul>
  );
}
