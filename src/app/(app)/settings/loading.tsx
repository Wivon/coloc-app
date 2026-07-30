import { CardSkeleton, HeaderSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <>
      <HeaderSkeleton title="Réglages" />
      <div className="flex flex-col gap-4">
        <CardSkeleton className="h-44" />
        <CardSkeleton className="h-32" />
        <CardSkeleton className="h-36" />
      </div>
    </>
  );
}
