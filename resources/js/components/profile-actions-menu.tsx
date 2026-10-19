import { Form, router } from '@inertiajs/react';
import { Ellipsis, KeyRound, Radio, Square } from 'lucide-react';
import { useState } from 'react';
import UserLiveController from '@/actions/App/Http/Controllers/UserLiveController';
import UserLiveInputController from '@/actions/App/Http/Controllers/UserLiveInputController';
import { CopyableCode } from '@/components/copyable-code';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { LiveInput, User } from '@/types';

const hours = Array.from({ length: 12 }, (_, index) => index + 1);

const fieldClassName =
    'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30';

type Source = 'here' | 'youtube';

/**
 * The quick actions on your own profile, where other people's profiles have the mute and block menu.
 */
export function ProfileActionsMenu({
    user,
    canStreamHere,
}: {
    user: Pick<User, 'live'>;
    canStreamHere: boolean;
}) {
    const [isGoingLive, setIsGoingLive] = useState(false);
    const [isEnding, setIsEnding] = useState(false);
    const [source, setSource] = useState<Source>(
        canStreamHere ? 'here' : 'youtube',
    );

    const endStream = () =>
        router.visit(UserLiveController.destroy(), {
            preserveScroll: true,
            onStart: () => setIsEnding(true),
            onFinish: () => setIsEnding(false),
            onSuccess: () => router.flushAll(),
        });

    return (
        <>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        aria-label="More options"
                        data-test="profile-actions-menu"
                    >
                        <Ellipsis />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    {user.live ? (
                        <DropdownMenuItem
                            disabled={isEnding}
                            onSelect={endStream}
                            data-test="end-stream"
                        >
                            <Square />
                            End stream
                        </DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem
                            onSelect={() => setIsGoingLive(true)}
                            data-test="go-live"
                        >
                            <Radio />
                            Go live
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isGoingLive} onOpenChange={setIsGoingLive}>
                <DialogContent>
                    <DialogTitle>Go live</DialogTitle>
                    <DialogDescription>
                        {source === 'here'
                            ? 'Stream from OBS or any software that speaks RTMPS, and people watch you right here. Your avatar gets a live marker for as long as you choose.'
                            : 'Share your YouTube stream and your avatar gets a live marker that sends people to it, for as long as you choose.'}
                    </DialogDescription>

                    {canStreamHere && (
                        <div
                            role="radiogroup"
                            aria-label="Where you stream"
                            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
                        >
                            {(
                                [
                                    ['here', 'Stream here'],
                                    ['youtube', 'YouTube link'],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={source === value}
                                    onClick={() => setSource(value)}
                                    className={cn(
                                        'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
                                        source === value &&
                                            'bg-background text-foreground shadow-xs',
                                    )}
                                    data-test={`live-source-${value}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}

                    {source === 'here' ? (
                        <StreamHereForm
                            onLive={() => {
                                setIsGoingLive(false);
                                router.flushAll();
                            }}
                        />
                    ) : (
                        <Form
                            {...UserLiveController.update.form()}
                            options={{ preserveScroll: true }}
                            onSuccess={() => {
                                setIsGoingLive(false);
                                router.flushAll();
                            }}
                            resetOnSuccess
                        >
                            {({ processing, errors }) => (
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="live-url">
                                            Stream link
                                        </Label>
                                        <input
                                            id="live-url"
                                            type="url"
                                            name="url"
                                            required
                                            autoFocus
                                            placeholder="https://www.youtube.com/live/…"
                                            className={fieldClassName}
                                            data-test="live-url-input"
                                        />
                                        <InputError message={errors.url} />
                                    </div>

                                    <HoursField error={errors.hours} />

                                    <GoLiveFooter processing={processing} />
                                </div>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

/**
 * The stream key is fetched on demand and only kept in this dialog, so it never sits in a page someone could share.
 */
function StreamHereForm({ onLive }: { onLive: () => void }) {
    const [liveInput, setLiveInput] = useState<LiveInput | null>(null);
    const [isFetching, setIsFetching] = useState(false);

    const fetchKey = () =>
        router.post(
            UserLiveInputController.store(),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setIsFetching(true),
                onFinish: () => setIsFetching(false),
                onSuccess: (page) => setLiveInput(page.flash.liveInput ?? null),
            },
        );

    if (!liveInput) {
        return (
            <div className="grid gap-4">
                <p className="text-sm text-muted-foreground">
                    Your stream key stays the same between streams, so you only
                    set up your streaming software once.
                </p>
                <DialogFooter className="mt-2 gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        onClick={fetchKey}
                        disabled={isFetching}
                        data-test="live-get-key"
                    >
                        <KeyRound />
                        Get stream key
                    </Button>
                </DialogFooter>
            </div>
        );
    }

    return (
        <Form
            {...UserLiveInputController.update.form()}
            options={{ preserveScroll: true }}
            onSuccess={onLive}
            className="min-w-0"
        >
            {({ processing, errors }) => (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
                        <Label>Server</Label>
                        <CopyableCode
                            code={liveInput.rtmps_url}
                            label="server"
                        />
                    </div>
                    <div
                        className="grid grid-cols-[minmax(0,1fr)] gap-2"
                        data-test="live-stream-key"
                    >
                        <Label>Stream key</Label>
                        <CopyableCode
                            code={liveInput.stream_key}
                            label="stream key"
                        />
                        <p className="text-xs text-muted-foreground">
                            Anyone with this key can stream as you. Keep it
                            private.
                        </p>
                    </div>

                    <HoursField error={errors.hours} />

                    <GoLiveFooter processing={processing} />
                </div>
            )}
        </Form>
    );
}

function HoursField({ error }: { error?: string }) {
    return (
        <div className="grid gap-2">
            <Label htmlFor="live-hours">For</Label>
            <select
                id="live-hours"
                name="hours"
                defaultValue={2}
                className={fieldClassName}
                data-test="live-hours-select"
            >
                {hours.map((count) => (
                    <option key={count} value={count}>
                        {count === 1 ? '1 hour' : `${count} hours`}
                    </option>
                ))}
            </select>
            <InputError message={error} />
        </div>
    );
}

function GoLiveFooter({ processing }: { processing: boolean }) {
    return (
        <DialogFooter className="mt-2 gap-2">
            <DialogClose asChild>
                <Button type="button" variant="outline">
                    Cancel
                </Button>
            </DialogClose>
            <Button
                type="submit"
                disabled={processing}
                data-test="go-live-button"
            >
                <Radio />
                Go live
            </Button>
        </DialogFooter>
    );
}
