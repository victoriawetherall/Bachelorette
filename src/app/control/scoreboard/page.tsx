"use client";
import OverallScores from "@/components/OverallScores";
import QuizAccess from "@/components/QuizAccess";
export default function ScoreboardPage() { return <QuizAccess role="host">{() => <OverallScores host />}</QuizAccess>; }
