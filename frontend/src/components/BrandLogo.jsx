import React, { useState } from "react";
import logoLight from "@/assets/forsides-logo.png";
import logoDark from "@/assets/forsides-logo-dark.png";

// The FORSIDES logo, bundled with the app (it no longer depends on a file being served separately).
// If the image ever fails to load, the name is written instead of showing a broken image.
export const BrandLogo = ({ dark = false, className = "h-10 w-auto" }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={`inline-flex flex-col leading-none ${dark ? "text-white" : "text-forsides-ink"}`}>
        <span className="font-serif text-xl font-black tracking-tight">FORSIDES</span>
        <span className="text-[10px] italic text-forsides-red">Solutions actuarielles</span>
      </span>
    );
  }
  return <img src={dark ? logoDark : logoLight} alt="FORSIDES, Solutions actuarielles" className={className} onError={() => setFailed(true)} />;
};

export { logoLight as forsidesLogoUrl };
