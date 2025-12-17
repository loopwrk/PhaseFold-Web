import * as Tone from "tone";
import { durations } from "~/constants/music";

const loops: Tone.Loop[] = [];
const synths: (Tone.Synth | Tone.FMSynth | Tone.AMSynth)[] = [];
const parts: Tone.Part[] = [];

let synth: Tone.Synth | null = null;
const timeContext = ref<number>(0);
let timeInterval: number | null = null;
const currentlyPlaying = ref<boolean>(false);
const currentPlayingNote = ref<string | null>(null);
const currentPlayingIndex = ref<number | null>(null);

export function usePlayAudio() {
  const init = async () => {
    await Tone.start();
    if (!synth) synth = new Tone.Synth().toDestination();
  };

  const singleNote = async (note: string) => {
    await init();
    const now = Tone.now();
    synth?.triggerAttack(note, now);
    synth?.triggerRelease(now + 1);
  };

  const multipleNotes = async (
    noteSequence: Array<string> = ["C4", "C4", "G4", "G4", "A4", "A4", "G4"],
    restTime: number = 0.5
  ) => {
    await init();

    parts.forEach((part) => part.dispose());
    parts.length = 0;

    const events = noteSequence.map((note, index) => [
      index * restTime,
      { note, index },
    ]);

    // Create a Part for the note sequence
    const part = new Tone.Part((time, value) => {
      const { note, index } = value as { note: string; index: number };

      synth?.triggerAttackRelease(note, durations.eighth, time);

      Tone.getDraw().schedule(() => {
        currentPlayingNote.value = note;
        currentPlayingIndex.value = index;
      }, time);

      Tone.getDraw().schedule(
        () => {
          currentPlayingNote.value = null;
          currentPlayingIndex.value = null;
        },
        time + Tone.Time(durations.eighth).toSeconds()
      );
    }, events);

    parts.push(part);

    part.start(0);
    part.stop(noteSequence.length * restTime);

    Tone.getTransport().start();
    currentlyPlaying.value = true;

    // Stop transport and cleanup after sequence completes
    setTimeout(
      () => {
        Tone.getTransport().stop();
        part.dispose();
        currentlyPlaying.value = false;
        const index = parts.indexOf(part);
        if (index > -1) parts.splice(index, 1);
      },
      (noteSequence.length * restTime + 1) * 1000
    );
  };

  const startScheduled = async () => {
    await init();

    const synthA = new Tone.FMSynth().toDestination();
    const synthB = new Tone.AMSynth().toDestination();
    synths.push(synthA, synthB);

    //play a note every quarter-note
    const loopA = new Tone.Loop((time) => {
      synthA.triggerAttackRelease("C2", durations.eighth, time);
    }, durations.quarter).start(0);

    const loopB = new Tone.Loop((time) => {
      synthB.triggerAttackRelease("C4", durations.eighth, time);
    }, durations.quarter).start(durations.eighth);

    loops.push(loopA, loopB);

    // all loops start when the Transport is started
    Tone.getTransport().start();
    // ramp up to 800 bpm over 10 seconds
    Tone.getTransport().bpm.rampTo(800, 10);
  };

  const stopScheduled = () => {
    Tone.getTransport().stop();
    loops.forEach((loop) => loop.dispose());
    loops.length = 0;
    synths.forEach((s) => s.dispose());
    synths.length = 0;
  };

  const startTimeContext = () => {
    if (timeInterval) return; // already running

    timeInterval = setInterval(() => {
      timeContext.value = Tone.now();
    }, 100);
  };

  const stopTimeContext = () => {
    if (timeInterval) {
      clearInterval(timeInterval);
      timeInterval = null;
    }
  };

  return {
    currentlyPlaying,
    singleNote,
    multipleNotes,
    startScheduled,
    stopScheduled,
    timeContext,
    currentPlayingNote,
    currentPlayingIndex,
    startTimeContext,
    stopTimeContext,
  };
}
