import type { Metadata } from 'next';

import { PageHeader } from '@/components/PageHeader';
import { HouseholdCard } from '@/components/settings/HouseholdCard';
import { InviteCard } from '@/components/settings/InviteCard';
import { NotificationsCard } from '@/components/settings/NotificationsCard';
import { PasskeysCard } from '@/components/settings/PasskeysCard';
import { ProfileCard } from '@/components/settings/ProfileCard';
import { SignOutButton } from '@/components/settings/SignOutButton';
import { listCredentials } from '@/lib/auth/passkeys';
import { requireHouseholdContext } from '@/lib/domain/households';

export const metadata: Metadata = { title: 'Réglages' };

export default async function SettingsPage() {
  const { household, user, members } = await requireHouseholdContext();
  const credentials = await listCredentials(user.id);

  return (
    <>
      <PageHeader title="Réglages" subtitle={household.name} />

      <div className="flex flex-col gap-4">
        <ProfileCard
          userId={user.id}
          displayName={user.display_name}
          avatarColor={user.avatar_color}
          email={user.email}
        />

        <NotificationsCard vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''} />

        <InviteCard inviteCode={household.invite_code} householdName={household.name} />

        <HouseholdCard name={household.name} members={members} />

        <PasskeysCard
          passkeys={credentials.map((credential) => ({
            id: credential.id,
            deviceType: credential.device_type,
            createdAt: credential.created_at,
            lastUsedAt: credential.last_used_at,
          }))}
        />

        <SignOutButton />

        <p className="pb-2 text-center text-[12px] text-subtle">ColocApp</p>
      </div>
    </>
  );
}
