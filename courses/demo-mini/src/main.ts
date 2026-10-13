import '@coursekit/ui/theme.css';
import { mountCourse } from '@coursekit/ui';
import course from './course.ts';
import { stage } from './stage.ts';

const handle = mountCourse(document.getElementById('app')!, course, { stage: stage() });
if (import.meta.env.DEV) (window as any).course = handle;
