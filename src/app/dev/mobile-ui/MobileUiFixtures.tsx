"use client";

import { useState } from "react";
import { CompactPlayerCard } from "@/components/ui/CompactPlayerCard";
import { GameButton } from "@/components/ui/GameButton";
import {
  CompactFixtureCard,
  CompactMetricRow,
  CompactResultRow,
  MobilePageHeader,
  MobilePrimaryAction,
  MobileSection,
  MobileSectionHeader,
} from "@/components/ui/MobileLayout";
import { MobileBottomSheet, MobileModal } from "@/components/ui/MobileOverlay";
import { MobileStepIndicator } from "@/components/ui/MobileStepIndicator";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const STEPS = ["Mode", "Spin", "Choose", "Squad", "Match", "Result"];

export default function MobileUiFixturesPage() {
  const [step, setStep] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(false);

  return (
    <StandardPageShell>
      <div className={`mx-auto max-w-md ${SPACING.stackLg}`}>
        <MobilePageHeader
          title="Mobile UI Fixtures"
          context="Regression — names, tiers, clubs, sheets, steps"
          actions={
            <GameButton
              variant="secondary"
              size="sm"
              fullWidth={false}
              onClick={() => setStep((s) => (s + 1) % STEPS.length)}
            >
              Next step
            </GameButton>
          }
        />

        <MobileStepIndicator steps={STEPS} currentIndex={step} />

        <MobileSection>
          <MobileSectionHeader
            label="Players"
            title="CompactPlayerCard"
            subtitle="Short, long, Legend, light/dark kit"
          />
          <div className={SPACING.stackSm}>
            <CompactPlayerCard
              name="Jo"
              position="HB"
              nationality="ENG"
              club="Wigan"
              rating={72}
              accentColor="#ed1c24"
            />
            <CompactPlayerCard
              name="Jonathan Davies-Williams"
              position="Stand-off"
              nationality="Wales"
              club="St Helens RLFC"
              rating={88}
              accentColor="#ee1c25"
              tierBadge={
                <span className="text-[10px] font-bold uppercase tracking-wide text-accent-gold">
                  Legend
                </span>
              }
              selected={selected}
              onClick={() => setSelected((v) => !v)}
            >
              <div className="flex gap-2">
                <GameButton variant="theme" size="sm" onClick={() => undefined}>
                  Select
                </GameButton>
                <GameButton
                  variant="secondary"
                  size="sm"
                  onClick={() => undefined}
                >
                  Respin
                </GameButton>
              </div>
            </CompactPlayerCard>
            <CompactPlayerCard
              name="Club Legend Light Kit"
              position="Prop"
              nationality="ENG"
              club="Leeds Rhinos"
              rating={84}
              accentColor="#f5f5f5"
              tierBadge={
                <span className="text-[10px] font-bold uppercase tracking-wide text-sky-300">
                  Club Legend
                </span>
              }
            />
            <CompactPlayerCard
              name="Dark Kit GOAT"
              position="Fullback"
              nationality="AUS"
              club="Hull FC"
              rating={96}
              accentColor="#0a0a0a"
              tierBadge={
                <span className="text-[10px] font-bold uppercase tracking-wide text-accent-gold">
                  GOAT
                </span>
              }
            />
          </div>
        </MobileSection>

        <MobileSection>
          <MobileSectionHeader title="Hub · Next Fixture" />
          <CompactFixtureCard accentColor="#ed1c24">
            <p className={`${TYPO.keyLabel} mb-2`}>Round 14 · Away</p>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <p className={`${TYPO.cardTitle} truncate text-left`}>Wigan</p>
              <p className="font-display text-lg font-black tabular-nums">vs</p>
              <p className={`${TYPO.cardTitle} truncate text-right`}>
                Catalans
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <GameButton variant="theme" size="sm" onClick={() => undefined}>
                Play Game
              </GameButton>
              <GameButton
                variant="secondary"
                size="sm"
                onClick={() => undefined}
              >
                Simulate Game
              </GameButton>
            </div>
          </CompactFixtureCard>
          <div className="mt-3">
            <CompactMetricRow label="Played" value="13" />
            <CompactMetricRow label="Points" value="22" />
            <CompactMetricRow label="Form" value="W W L W D" />
          </div>
        </MobileSection>

        <MobileSection>
          <MobileSectionHeader title="Match result" align="center" />
          <p className="text-center font-display text-3xl font-black tabular-nums tracking-tight">
            24–18
          </p>
          <CompactResultRow home="Leeds" away="Hull KR" score="24–18" />
          <p className={`mt-2 text-center ${TYPO.meta}`}>
            Match Results collapsed on mobile by default
          </p>
        </MobileSection>

        <MobileSection>
          <MobileSectionHeader
            title="Reserve (contracts language)"
            align="center"
          />
          <div className="text-left">
            <p className={TYPO.playerNameSm}>Alex Reserve-Longname</p>
            <p className={TYPO.meta}>Hooker · 19 · Available · 1yr left</p>
            <CompactMetricRow label="Rating" value="68" />
            <CompactMetricRow label="Potential" value="82" />
            <div className="mt-3 flex gap-2">
              <GameButton variant="theme" size="sm" onClick={() => undefined}>
                Call Up
              </GameButton>
              <GameButton
                variant="ghost"
                size="sm"
                onClick={() => undefined}
              >
                More
              </GameButton>
            </div>
          </div>
        </MobileSection>

        <MobileSection flush>
          <MobileSectionHeader
            title="Flush section"
            subtitle="No surface chrome"
            collapseSubtitleOnMobile={false}
          />
          <p className={TYPO.bodySm}>
            Used when the parent already provides padding or a card.
          </p>
        </MobileSection>

        <div className={`flex flex-col gap-2 ${SPACING.stackSm}`}>
          <MobilePrimaryAction
            label="Open bottom sheet"
            onClick={() => setSheetOpen(true)}
          />
          <GameButton variant="secondary" onClick={() => setModalOpen(true)}>
            Open Future Star modal
          </GameButton>
        </div>

        <MobileBottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Filters"
          footer={
            <GameButton variant="theme" onClick={() => setSheetOpen(false)}>
              Apply
            </GameButton>
          }
        >
          <p className={TYPO.bodySm}>
            Sheet docks above the footer with safe-area padding. Escape and
            backdrop close it.
          </p>
        </MobileBottomSheet>

        <MobileModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Future Star"
          footer={
            <GameButton variant="theme" onClick={() => setModalOpen(false)}>
              Continue
            </GameButton>
          }
        >
          <p className={TYPO.bodySm}>
            Centred modal for major reveals — not a nested decorative card.
          </p>
        </MobileModal>
      </div>
    </StandardPageShell>
  );
}
