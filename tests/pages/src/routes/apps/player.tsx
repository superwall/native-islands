import * as React from "react";
import { Segments } from "../../components/controls";
import { IconGlass } from "../../components/icons";
import { Slider } from "../../components/stateful";

const QUEUE = [
  { title: "Glasshouse", artist: "Aster & The Lowlights", length: "3:41" },
  { title: "Low Tide", artist: "Marlo Vane", length: "4:12" },
  { title: "Paper Moons", artist: "The Quiet Hours", length: "2:58" },
  { title: "Northbound", artist: "Aster & The Lowlights", length: "5:03" },
  { title: "Static Bloom", artist: "Juno Park", length: "3:27" },
  { title: "Afterimage", artist: "Marlo Vane", length: "4:45" },
  { title: "Slow Signal", artist: "The Quiet Hours", length: "3:09" },
];

const LYRICS = [
  "Headlights on the overpass",
  "the city humming under glass",
  "we drove until the radio",
  "forgot the words we used to know",
];

const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/**
 * A music player's now-playing screen: glass transport controls merged into
 * one group, a native scrubber, a segmented switch between the queue and the
 * lyrics, and a toolbar that stays stuck to the bottom as the list scrolls.
 */
export default function Player() {
  const [playing, setPlaying] = React.useState(false);
  const [position, setPosition] = React.useState(74);
  const [tab, setTab] = React.useState(0);
  const [liked, setLiked] = React.useState(false);
  const length = 221;

  React.useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setPosition((value) => (value + 1) % length), 1000);
    return () => clearInterval(timer);
  }, [playing]);

  return (
    <main className="page app app--player" data-scenario="A01" data-expect="native">
      <div className="artwork" aria-hidden="true">
        <span className="artwork-sun" />
        <span className="artwork-hills" />
      </div>
      <div className="track">
        <div>
          <h1>Midnight Drive</h1>
          <p className="lede">Aster &amp; The Lowlights</p>
        </div>
        <IconGlass
          symbol="heart.fill"
          label={liked ? "Unlike" : "Like"}
          tint={liked ? "#ff4f6d" : undefined}
          prominent={liked}
          onPress={() => setLiked(!liked)}
        />
      </div>
      <div className="scrubber">
        <Slider
          value={position}
          minimum={0}
          maximum={length}
          step={1}
          onStateChange={(state) => {
            if (typeof state.value === "number") setPosition(state.value);
          }}
        >
          <input
            type="range"
            className="range"
            aria-label="Position"
            min={0}
            max={length}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
          />
        </Slider>
        <div className="scrubber-times micro">
          <span>{time(position)}</span>
          <span>-{time(length - position)}</span>
        </div>
      </div>
      <div className="transport">
        <IconGlass
          symbol="backward.fill"
          label="Previous"
          glassGroup="transport"
          size={56}
          onPress={() => setPosition(0)}
        />
        <IconGlass
          symbol={playing ? "pause.fill" : "play.fill"}
          label={playing ? "Pause" : "Play"}
          glassGroup="transport"
          prominent
          tint="#f6f2ea"
          size={76}
          islandId="player-play"
          onPress={() => setPlaying(!playing)}
        />
        <IconGlass
          symbol="forward.fill"
          label="Next"
          glassGroup="transport"
          size={56}
          onPress={() => setPosition(Math.min(length, position + 15))}
        />
      </div>
      <Segments segments={["Up next", "Lyrics"]} selectedIndex={tab} onChange={setTab} />
      {tab === 0 ? (
        <ol className="queue">
          {QUEUE.map((song, index) => (
            <li key={song.title}>
              <span className="queue-cover" data-hue={index % 4} />
              <span className="queue-text">
                <strong>{song.title}</strong>
                <span>{song.artist}</span>
              </span>
              <span className="micro">{song.length}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="lyrics">
          {LYRICS.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      <div className="app-toolbar">
        <IconGlass symbol="airplayaudio" label="AirPlay" glassGroup="toolbar" />
        <IconGlass
          symbol="quote.bubble"
          label="Lyrics"
          glassGroup="toolbar"
          onPress={() => setTab(1)}
        />
        <IconGlass
          symbol="list.bullet"
          label="Queue"
          glassGroup="toolbar"
          onPress={() => setTab(0)}
        />
      </div>
    </main>
  );
}
