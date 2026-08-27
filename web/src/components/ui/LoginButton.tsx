import { User } from "firebase/auth";
import { Button } from "./Button";

export interface Props {
    onSignIn: () => void;
    onSignOut: () => void;
    onPlayerTap?: () => void;
    user: User | null;
    playerName: string | null;
    /** Replaces the default title-screen styling. Toolbars pass their own
     *  button classes so this control matches its neighbours instead of
     *  dragging the title screen's gold outline into a menu that has none —
     *  and so both states render as the same kind of button, which the
     *  default path (a plain button when signed in, an `action-btn` when
     *  signed out) does not. */
    className?: string;
}

export function LoginButton({ onSignIn, onPlayerTap, user, playerName, className }: Props) {
    const signedIn = !!user && !user.isAnonymous
    const icon  = signedIn ? '👤' : '🔒'
    const label = signedIn ? (playerName ?? user!.displayName ?? user!.email) : 'SIGN IN'
    const body  = (
        <>
            <span className="filter-btn-icon">{icon}</span>
            <span>{label}</span>
        </>
    )

    if (className) {
        return (
            <button
                className={className}
                onClick={signedIn ? onPlayerTap : onSignIn}
                title={signedIn ? 'Your profile' : 'Sign in'}
            >
                {body}
            </button>
        )
    }

    // Default (title screen) styling, unchanged: the dimmed .title-auth-label
    // when signed in, an action-btn when there's a sign-in call to action.
    return signedIn ? (
        <button className="title-auth-btn title-auth-label" onClick={onPlayerTap}>{body}</button>
    ) : (
        <Button className="title-auth-btn" onClick={onSignIn}>{body}</Button>
    )
}
