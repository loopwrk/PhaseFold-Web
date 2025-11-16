import * as Tone from "tone";

const loops: Tone.Loop[] = [];
const synths: (Tone.Synth | Tone.FMSynth | Tone.AMSynth)[] = [];

export function usePlayAudio() {
  let synth: Tone.Synth | null = null;
  const timeContext = ref<number>(0);
  let timeInterval: number | null = null;

  const init = async () => {
    await Tone.start();
    if (!synth) synth = new Tone.Synth().toDestination();
  };

  const singleNote = async () => {
    await init();
    const now = Tone.now();
    synth?.triggerAttack("C4", now);
    synth?.triggerRelease(now + 1);
  };

  const multipleNotes = async () => {
    await init();
    const now = Tone.now();
    synth?.triggerAttackRelease("C4", "8n", now);
    synth?.triggerAttackRelease("E4", "8n", now + 0.5);
    synth?.triggerAttackRelease("G4", "8n", now + 1);
  };

  const startScheduled = async () => {
    await init();

    // create two monophonic synths
    const synthA = new Tone.FMSynth().toDestination();
    const synthB = new Tone.AMSynth().toDestination();
    synths.push(synthA, synthB);

    //play a note every quarter-note
    const loopA = new Tone.Loop((time) => {
      synthA.triggerAttackRelease("C2", "8n", time);
    }, "4n").start(0);

    const loopB = new Tone.Loop((time) => {
      synthB.triggerAttackRelease("C4", "8n", time);
    }, "4n").start("8n");

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
    stopScheduled,
    singleNote,
    multipleNotes,
    startScheduled,
    timeContext,
    startTimeContext,
    stopTimeContext,
  };
}
