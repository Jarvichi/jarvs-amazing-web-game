import { User } from "firebase/auth";
import { Button } from "./Button";

export interface Props {
    onSignIn: () => void;
    onSignOut: () => void;
    onPlayerTap?: () => void;
    user: User | null;
    playerName: string | null;
}

export function LoginButton({ onSignIn, onPlayerTap, user, playerName }: Props) {
    return (
        <>
            {user && !user.isAnonymous ? (
                <button className="title-auth-btn title-auth-label" onClick={onPlayerTap}>
                    👤 {playerName ?? user.displayName ?? user.email}
                </button>
            ) : (
                <Button className="title-auth-btn" onClick={onSignIn}>
                    🔒 SIGN IN
                </Button>
            )}
        </>
    )
}
