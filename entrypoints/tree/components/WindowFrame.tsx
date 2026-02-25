import type { ReactNode } from 'react';

export function WindowFrame({
  type,
  children,
}: {
  type: string;
  children: ReactNode;
}) {
  return <span className={`window-frame-box ${type}`}>{children}</span>;
}
