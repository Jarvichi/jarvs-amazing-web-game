import { User } from "firebase/auth";
import { Button } from "./Button";

export interface Props {
    onSignIn: () => void;
    onSignOut: () => void;
    user: User | null;
    playerName: string | null;
}

export function LoginButton({ onSignIn, onSignOut, user, playerName }: Props) {
    return (
        <>
            {user && !user.isAnonymous ? (
                <div className="title-auth-bar">
                    <span className="title-auth-label">👤 {playerName ?? user.displayName ?? "user.email"}</span>
                    <Button className="title-auth-btn" onClick={onSignOut}>
                      🔓 SIGN OUT
                    </Button>
                </div>
            ) : (
                <Button className="title-auth-btn" onClick={onSignIn}>
                    🔒 SIGN IN
                </Button>
            )}

        </>
    )
}