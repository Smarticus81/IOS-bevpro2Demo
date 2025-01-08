// Add ElevenLabs Convai custom element type
declare namespace JSX {
  interface IntrinsicElements {
    'elevenlabs-convai': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'agent-id'?: string;
      },
      HTMLElement
    >;
  }
}
