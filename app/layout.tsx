import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Smart Syllabus Visualizer',
  description:
    'Upload your syllabi. See your entire semester in 30 seconds. AI extracts every deadline, exam, and grading weight into one visual timeline.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
