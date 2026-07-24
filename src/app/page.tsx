import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/domain/households';

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? '/tasks' : '/login');
}
