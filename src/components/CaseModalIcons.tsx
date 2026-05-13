type IconProps = {
  className?: string;
};

function iconClass(className?: string) {
  return className || "h-5 w-5";
}

export function ZoomInIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  );
}

export function ZoomOutIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
      <path d="M8 11h6" />
    </svg>
  );
}

export function TranslateIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 5h10" />
      <path d="M9 3v2" />
      <path d="M6 9c1.5 3 4.5 5 8 5" />
      <path d="M13 9c-.8 1.8-2.1 3.3-3.7 4.4" />
      <path d="M15 20l3-8 3 8" />
      <path d="M16.2 17h3.6" />
    </svg>
  );
}

export function FindIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function PrintIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 8V3h10v5" />
      <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7z" />
    </svg>
  );
}

export function FeedbackIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function DocDownloadIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

export function PdfDownloadIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13h1a2 2 0 0 1 0 4H9v-4z" />
      <path d="M14 13h2" />
      <path d="M14 17h2" />
      <path d="M19 13v4" />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4Z" />
    </svg>
  );
}
