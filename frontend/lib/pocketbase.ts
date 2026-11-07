import PocketBase from 'pocketbase';
import { cookies } from 'next/headers';

// Instanciacion para server components y route handlers
export async function createServerClient(){
    const pb = new PocketBase(process.env.POCKETBASE_URL!);
    const cookieStore = cookies();

    const authCookie = (await cookieStore).get('pb_auth');
    if (authCookie) {
        pb.authStore.loadFromCookie(authCookie.value);
    }
    return pb;

}

/**
 * instancia para el Client Components
 */
export function createClientClient(){
    const pb = new PocketBase(process.env.POCKETBASE_URL!);
    return pb;
}