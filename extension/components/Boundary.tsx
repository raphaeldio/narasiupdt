import { Component, type ReactNode } from 'react';

/**
 * Galat render di satu komponen tidak boleh mematikan seluruh overlay: tanpa pembatas ini React melepas
 * semua tampilan dan badge tidak pernah muncul lagi sampai halaman dimuat ulang. Pembatas pulih sendiri
 * begitu `resetKey` berubah (video atau hasil berikutnya). Pesan galat ditaruh di atribut untuk diagnosis.
 */
export class Boundary extends Component<{ resetKey: string; children: ReactNode }, { error: string | null; at: string }> {
  override state = { error: null as string | null, at: '' };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { error: string | null; at: string }) {
    if (props.resetKey === state.at) return null;
    // Kunci berubah: coba render lagi. Galat yang baru terjadi pada kunci ini tetap ditahan.
    return state.at === '' || state.error === null ? { at: props.resetKey } : { at: props.resetKey, error: null };
  }

  override render() {
    if (this.state.error) return <span hidden data-nr-error={this.state.error} />;
    return this.props.children;
  }
}
