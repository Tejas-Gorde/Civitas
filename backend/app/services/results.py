import re
from datetime import datetime, timezone
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models import Candidate, Election, User, Vote, Voter, VoterElectionStatus


def calculate_election_results(election_id: str, db: Session, show_voter_names: bool = False) -> dict:
    clean_id = str(election_id).strip()
    election = db.scalar(
        select(Election).where(
            (func.lower(Election.id) == clean_id.lower()) |
            (func.lower(Election.election_id) == clean_id.lower())
        )
    )
    if not election:
        return {}

    voting_type = getattr(election, "voting_type", "regular") or "regular"

    # Base Voter Statistics
    registered_voters = db.scalar(
        select(func.count(VoterElectionStatus.id)).where(VoterElectionStatus.election_id == election.id)
    ) or 0

    eligible_voters = (
        db.scalar(
            select(func.count(VoterElectionStatus.id))
            .join(Voter, VoterElectionStatus.voter_id == Voter.id)
            .join(User, Voter.user_id == User.id)
            .where(
                VoterElectionStatus.election_id == election.id,
                User.is_active.is_(True),
                VoterElectionStatus.eligible.is_(True),
            )
        )
        or registered_voters
    )

    # Distinct ballots cast by voters who completed voting
    voters_who_voted = db.scalar(
        select(func.count(VoterElectionStatus.id))
        .where(
            VoterElectionStatus.election_id == election.id,
            VoterElectionStatus.voted_at.is_not(None),
        )
    ) or 0

    # Total vote rows stored in votes table
    total_vote_records = db.scalar(
        select(func.count(Vote.id)).where(Vote.election_id == election.id)
    ) or 0

    # For single-choice, voters_who_voted == total_vote_records (unless unrecorded, fallback to max)
    ballots_cast = max(voters_who_voted, total_vote_records if voting_type != "multiple_choice" else voters_who_voted)
    if ballots_cast == 0 and total_vote_records > 0:
        ballots_cast = total_vote_records

    turnout_pct = round(100.0 * ballots_cast / eligible_voters, 2) if eligible_voters > 0 else 0.0

    raw_candidates = db.scalars(
        select(Candidate).where(Candidate.election_id == election.id).order_by(Candidate.created_at.asc())
    ).all()

    # Voter Registration Mode & Quick Voter Records
    voter_registration_mode = getattr(election, "voter_registration_mode", "pre_registered") or "pre_registered"
    from app.models import QuickVoterRecord
    quick_records = db.scalars(
        select(QuickVoterRecord).where(QuickVoterRecord.election_id == election.id).order_by(QuickVoterRecord.cast_at.asc())
    ).all()

    cand_map = {str(c.id): c for c in raw_candidates}
    voter_records = []
    for r in quick_records:
        vote_given_to = "N/A"
        if r.candidate_ids_json and len(r.candidate_ids_json) > 1:
            names = [cand_map[str(cid)].name for cid in r.candidate_ids_json if str(cid) in cand_map]
            vote_given_to = ", ".join(names) if names else "Multiple Options"
        elif r.candidate_id and str(r.candidate_id) in cand_map:
            vote_given_to = cand_map[str(r.candidate_id)].name
        elif r.candidate_ids_json and len(r.candidate_ids_json) == 1:
            cid = str(r.candidate_ids_json[0])
            vote_given_to = cand_map[cid].name if cid in cand_map else "Candidate"
        elif r.candidate_id:
            cand = db.get(Candidate, r.candidate_id)
            vote_given_to = cand.name if cand else "Candidate"

        voter_records.append({
            "id": str(r.id),
            "voter_name": r.voter_name,
            "prn": r.prn,
            "vote_given_to": vote_given_to,
            "candidate_id": str(r.candidate_id) if r.candidate_id else None,
            "candidate_ids": r.candidate_ids_json or ([str(r.candidate_id)] if r.candidate_id else []),
            "cast_at": r.cast_at.isoformat() if r.cast_at else "",
            "timestamp": r.cast_at.strftime("%d %b %Y %H:%M") if r.cast_at else "",
        })

    candidate_voters = []
    for c in raw_candidates:
        c_id_str = str(c.id)
        voters_for_c = []
        for r in quick_records:
            matches = False
            if r.candidate_id and str(r.candidate_id) == c_id_str:
                matches = True
            elif r.candidate_ids_json and c_id_str in [str(x) for x in r.candidate_ids_json]:
                matches = True
            if matches:
                voters_for_c.append({
                    "name": r.voter_name,
                    "voter_name": r.voter_name,
                    "prn": r.prn,
                    "cast_at": r.cast_at.isoformat() if r.cast_at else "",
                    "timestamp": r.cast_at.strftime("%d %b %Y %H:%M") if r.cast_at else "",
                })
        candidate_voters.append({
            "candidate_id": c_id_str,
            "candidate_name": c.name,
            "party": c.party or "",
            "total_votes": len(voters_for_c),
            "voters": voters_for_c,
        })

    if voter_registration_mode == "quick_entry" or quick_records:
        if len(quick_records) > 0:
            ballots_cast = max(ballots_cast, len(quick_records))
            registered_voters = max(registered_voters, len(quick_records))
            eligible_voters = max(eligible_voters, len(quick_records))
            turnout_pct = 100.0 if ballots_cast > 0 else 0.0

    # Voter Participation Log
    statuses = db.scalars(
        select(VoterElectionStatus)
        .where(VoterElectionStatus.election_id == election.id, VoterElectionStatus.voted_at.is_not(None))
        .order_by(VoterElectionStatus.voted_at.desc())
    ).all()

    participation_log = []
    include_names = show_voter_names or bool(election.show_voter_names_in_results) or (voter_registration_mode == "quick_entry")
    for st in statuses:
        voter_id_val = db.scalar(select(Voter.voter_id).where(Voter.id == st.voter_id)) or "VOTER"
        item = {
            "voter_id": voter_id_val,
            "voted_at": st.voted_at.isoformat() if st.voted_at else "",
        }
        if include_names:
            v_name = db.scalar(select(Voter.full_name).where(Voter.id == st.voter_id)) or ""
            item["voter_name"] = v_name
        participation_log.append(item)

    # Base Result Payload with Election Configuration
    max_selections = getattr(election, "max_selections", 1) or 1
    allow_abstain = bool(getattr(election, "allow_abstain", False))
    position_title = getattr(election, "position_title", None)

    base_result = {
        "election": {
            "id": str(election.id),
            "election_id": election.election_id or str(election.id),
            "name": election.name,
            "description": election.description or "",
            "voting_type": voting_type,
            "voter_registration_mode": voter_registration_mode,
            "status": election.state.value.upper() if hasattr(election.state, "value") else str(election.state).upper(),
            "starts_at": election.starts_at.isoformat() if election.starts_at else "",
            "ends_at": election.ends_at.isoformat() if election.ends_at else "",
            "show_voter_names_in_results": bool(election.show_voter_names_in_results),
            "max_selections": max_selections,
            "allow_abstain": allow_abstain,
            "position_title": position_title,
        },
        "statistics": {
            "registered_voters": registered_voters,
            "eligible_voters": eligible_voters,
            "votes_cast": ballots_cast,
            "total_vote_records": total_vote_records,
            "turnout_percentage": turnout_pct,
            "invalid_abstained_votes": 0,
        },
        "voting_type": voting_type,
        "voter_registration_mode": voter_registration_mode,
        "voter_participation_log": participation_log,
        "voter_records": voter_records,
        "quick_voter_records": voter_records,
        "candidate_voters": candidate_voters,
        "max_selections": max_selections,
        "allow_abstain": allow_abstain,
        "position_title": position_title,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }

    # =========================================================================
    # 1. GENERAL / REGULAR ELECTION RESULTS
    # =========================================================================
    if voting_type in ["regular", "general"]:
        candidate_list = []
        for c in raw_candidates:
            c_votes = db.scalar(
                select(func.count(Vote.id)).where(Vote.election_id == election.id, Vote.candidate_id == c.id)
            ) or 0
            pct = round(100.0 * c_votes / ballots_cast, 2) if ballots_cast > 0 else 0.0
            candidate_list.append({
                "id": str(c.id),
                "name": c.name,
                "party": c.party or "Independent",
                "manifesto": c.manifesto or "",
                "photo_url": c.photo_url,
                "symbol_url": c.symbol_url,
                "votes": c_votes,
                "percentage": pct,
            })

        candidate_list.sort(key=lambda item: item["votes"], reverse=True)
        for idx, c in enumerate(candidate_list):
            c["rank"] = idx + 1

        has_tie = len(candidate_list) > 1 and candidate_list[0]["votes"] > 0 and candidate_list[0]["votes"] == candidate_list[1]["votes"]
        winner = None
        if candidate_list and candidate_list[0]["votes"] > 0 and not has_tie:
            winner = {
                "id": candidate_list[0]["id"],
                "name": candidate_list[0]["name"],
                "party": candidate_list[0]["party"],
                "votes": candidate_list[0]["votes"],
                "percentage": candidate_list[0]["percentage"],
                "photo_url": candidate_list[0].get("photo_url"),
                "symbol_url": candidate_list[0].get("symbol_url"),
            }

        base_result["candidates"] = candidate_list
        base_result["winner"] = winner
        base_result["has_tie"] = has_tie
        return base_result

    # =========================================================================
    # 2. PRESIDENTIAL / LEADER ELECTION RESULTS
    # =========================================================================
    elif voting_type == "presidential":
        candidate_list = []
        for c in raw_candidates:
            c_votes = db.scalar(
                select(func.count(Vote.id)).where(Vote.election_id == election.id, Vote.candidate_id == c.id)
            ) or 0
            pct = round(100.0 * c_votes / ballots_cast, 2) if ballots_cast > 0 else 0.0
            candidate_list.append({
                "id": str(c.id),
                "name": c.name,
                "party": c.party or "Independent",
                "manifesto": c.manifesto or "",
                "photo_url": c.photo_url,
                "symbol_url": c.symbol_url,
                "votes": c_votes,
                "percentage": pct,
            })

        candidate_list.sort(key=lambda item: item["votes"], reverse=True)
        for idx, c in enumerate(candidate_list):
            c["rank"] = idx + 1

        has_tie = len(candidate_list) > 1 and candidate_list[0]["votes"] > 0 and candidate_list[0]["votes"] == candidate_list[1]["votes"]
        winner = None
        runner_up = None
        margin_pct = 0.0
        if candidate_list and candidate_list[0]["votes"] > 0:
            top = candidate_list[0]
            if not has_tie:
                winner = {
                    "id": top["id"],
                    "name": top["name"],
                    "party": top["party"],
                    "manifesto": top["manifesto"],
                    "votes": top["votes"],
                    "percentage": top["percentage"],
                    "photo_url": top.get("photo_url"),
                    "position": position_title or "President",
                }
            if len(candidate_list) > 1:
                sec = candidate_list[1]
                runner_up = {
                    "id": sec["id"],
                    "name": sec["name"],
                    "party": sec["party"],
                    "votes": sec["votes"],
                    "percentage": sec["percentage"],
                    "photo_url": sec.get("photo_url"),
                }
                margin_pct = round(top["percentage"] - sec["percentage"], 2)

        base_result["candidates"] = candidate_list
        base_result["winner"] = winner
        base_result["runner_up"] = runner_up
        base_result["margin_percentage"] = margin_pct
        base_result["has_tie"] = has_tie
        base_result["position_title"] = position_title or "President"
        return base_result

    # =========================================================================
    # 3. COUNCIL / COMMITTEE MULTI-SEAT ELECTION RESULTS
    # =========================================================================
    elif voting_type in ["council", "multiple_choice"]:
        options_list = []
        total_selections = total_vote_records

        for c in raw_candidates:
            selections = db.scalar(
                select(func.count(Vote.id)).where(Vote.election_id == election.id, Vote.candidate_id == c.id)
            ) or 0
            pct_of_voters = round(100.0 * selections / ballots_cast, 2) if ballots_cast > 0 else 0.0
            pct_of_total_selections = round(100.0 * selections / total_selections, 2) if total_selections > 0 else 0.0

            options_list.append({
                "id": str(c.id),
                "name": c.name,
                "party": c.party or "",
                "manifesto": c.manifesto or "",
                "photo_url": c.photo_url,
                "votes": selections,
                "selections_count": selections,
                "percentage": pct_of_voters,
                "percentage_of_voters": pct_of_voters,
                "percentage_of_total_selections": pct_of_total_selections,
            })

        options_list.sort(key=lambda item: item["selections_count"], reverse=True)
        seats_available = max_selections if max_selections > 1 else 1

        for idx, opt in enumerate(options_list):
            opt["rank"] = idx + 1
            opt["is_elected"] = (idx < seats_available) if opt["votes"] > 0 else False

        avg_selections = round(total_selections / ballots_cast, 2) if ballots_cast > 0 else 0.0

        base_result["council"] = {
            "total_voters": ballots_cast,
            "total_selections": total_selections,
            "average_selections_per_voter": avg_selections,
            "turnout_percentage": turnout_pct,
            "seats_available": seats_available,
            "elected_candidates": [c for c in options_list if c.get("is_elected")],
            "note": f"Voters could select up to {seats_available} candidates. Top {seats_available} candidates win seats.",
        }
        base_result["multiple_choice"] = base_result["council"]
        base_result["candidates"] = options_list
        base_result["options"] = options_list
        return base_result

    # =========================================================================
    # 4. REFERENDUM / YES-NO DECISION RESULTS
    # =========================================================================
    elif voting_type in ["referendum", "yes_no"]:
        yes_candidates = []
        no_candidates = []
        abstain_candidates = []
        other_candidates = []

        for c in raw_candidates:
            c_votes = db.scalar(
                select(func.count(Vote.id)).where(Vote.election_id == election.id, Vote.candidate_id == c.id)
            ) or 0
            cand_item = {
                "id": str(c.id),
                "name": c.name,
                "party": c.party or "",
                "manifesto": c.manifesto or "",
                "votes": c_votes,
                "percentage": round(100.0 * c_votes / ballots_cast, 2) if ballots_cast > 0 else 0.0,
            }
            c_name_lower = c.name.strip().lower()
            if any(k in c_name_lower for k in ["yes", "approve", "agree", "for", "in favor"]):
                yes_candidates.append(cand_item)
            elif any(k in c_name_lower for k in ["no", "reject", "disagree", "against"]):
                no_candidates.append(cand_item)
            elif "abstain" in c_name_lower:
                abstain_candidates.append(cand_item)
            else:
                other_candidates.append(cand_item)

        if not yes_candidates and raw_candidates:
            first_c = raw_candidates[0]
            first_votes = db.scalar(select(func.count(Vote.id)).where(Vote.election_id == election.id, Vote.candidate_id == first_c.id)) or 0
            yes_candidates.append({
                "id": str(first_c.id),
                "name": first_c.name,
                "party": first_c.party or "",
                "manifesto": first_c.manifesto or "",
                "votes": first_votes,
                "percentage": round(100.0 * first_votes / ballots_cast, 2) if ballots_cast > 0 else 0.0,
            })
        if not no_candidates and len(raw_candidates) > 1:
            second_c = raw_candidates[1]
            second_votes = db.scalar(select(func.count(Vote.id)).where(Vote.election_id == election.id, Vote.candidate_id == second_c.id)) or 0
            no_candidates.append({
                "id": str(second_c.id),
                "name": second_c.name,
                "party": second_c.party or "",
                "manifesto": second_c.manifesto or "",
                "votes": second_votes,
                "percentage": round(100.0 * second_votes / ballots_cast, 2) if ballots_cast > 0 else 0.0,
            })

        yes_votes = sum(c["votes"] for c in yes_candidates)
        no_votes = sum(c["votes"] for c in no_candidates)
        abstain_votes = sum(c["votes"] for c in abstain_candidates)
        effective_ballots = yes_votes + no_votes or ballots_cast

        yes_pct = round(100.0 * yes_votes / ballots_cast, 2) if ballots_cast > 0 else 0.0
        no_pct = round(100.0 * no_votes / ballots_cast, 2) if ballots_cast > 0 else 0.0
        abstain_pct = round(100.0 * abstain_votes / ballots_cast, 2) if ballots_cast > 0 else 0.0

        decision = "APPROVED" if yes_votes > no_votes else ("REJECTED" if no_votes > yes_votes else ("TIED" if ballots_cast > 0 else "NO VOTES"))
        margin = round(abs(yes_pct - no_pct), 2)
        proposal_text = election.description.strip() if election.description and election.description.strip() else election.name

        base_result["decision"] = {
            "proposal": proposal_text,
            "total_votes": ballots_cast,
            "yes_votes": yes_votes,
            "yes_percentage": yes_pct,
            "no_votes": no_votes,
            "no_percentage": no_pct,
            "abstain_votes": abstain_votes,
            "abstain_percentage": abstain_pct,
            "result": decision,
            "margin_percentage": margin,
        }
        all_options = yes_candidates + no_candidates + abstain_candidates + other_candidates
        for idx, opt in enumerate(all_options):
            opt["rank"] = idx + 1
        base_result["candidates"] = all_options
        base_result["options"] = all_options
        return base_result

    # =========================================================================
    # 5. POLL / RATING / CUSTOM RESULTS
    # =========================================================================
    elif voting_type == "poll":
        options_list = []
        for c in raw_candidates:
            c_votes = db.scalar(
                select(func.count(Vote.id)).where(Vote.election_id == election.id, Vote.candidate_id == c.id)
            ) or 0
            pct = round(100.0 * c_votes / ballots_cast, 2) if ballots_cast > 0 else 0.0
            options_list.append({
                "id": str(c.id),
                "name": c.name,
                "party": c.party or "",
                "description": c.manifesto or "",
                "votes": c_votes,
                "percentage": pct,
            })

        options_list.sort(key=lambda item: item["votes"], reverse=True)
        for idx, opt in enumerate(options_list):
            opt["rank"] = idx + 1

        has_tie = len(options_list) > 1 and options_list[0]["votes"] > 0 and options_list[0]["votes"] == options_list[1]["votes"]
        most_selected = None
        if options_list and options_list[0]["votes"] > 0:
            most_selected = {
                "name": options_list[0]["name"],
                "votes": options_list[0]["votes"],
                "percentage": options_list[0]["percentage"],
                "is_tied": has_tie,
            }

        poll_question = election.description.strip() if election.description and election.description.strip() else election.name

        base_result["poll"] = {
            "question": poll_question,
            "total_responses": ballots_cast,
            "response_rate": turnout_pct,
            "most_selected_option": most_selected,
            "has_tie": has_tie,
        }
        base_result["candidates"] = options_list
        base_result["options"] = options_list
        return base_result

    elif voting_type == "rating":
        rating_counts = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        options_list = []

        for c in raw_candidates:
            c_votes = db.scalar(
                select(func.count(Vote.id)).where(Vote.election_id == election.id, Vote.candidate_id == c.id)
            ) or 0

            star_level = None
            for num in [5, 4, 3, 2, 1]:
                if str(num) in c.name or (c.party and str(num) in c.party):
                    star_level = num
                    break

            options_list.append({
                "id": str(c.id),
                "name": c.name,
                "party": c.party or "",
                "star_level": star_level,
                "votes": c_votes,
                "percentage": round(100.0 * c_votes / ballots_cast, 2) if ballots_cast > 0 else 0.0,
            })

            if star_level in rating_counts:
                rating_counts[star_level] += c_votes

        unmapped_votes = [opt for opt in options_list if opt["star_level"] is None]
        if unmapped_votes and len(options_list) <= 5:
            for idx, opt in enumerate(options_list):
                level = 5 - idx if len(options_list) == 5 else (idx + 1)
                opt["star_level"] = level
                rating_counts[level] = opt["votes"]

        total_rating_points = sum(star * count for star, count in rating_counts.items())
        total_rated_ballots = sum(rating_counts.values()) or ballots_cast
        avg_rating = round(total_rating_points / total_rated_ballots, 2) if total_rated_ballots > 0 else 0.0

        distribution = []
        for star in [5, 4, 3, 2, 1]:
            cnt = rating_counts.get(star, 0)
            pct = round(100.0 * cnt / total_rated_ballots, 2) if total_rated_ballots > 0 else 0.0
            distribution.append({
                "star": star,
                "label": f"{star} ★",
                "count": cnt,
                "percentage": pct,
            })

        for idx, opt in enumerate(options_list):
            opt["rank"] = idx + 1

        base_result["rating"] = {
            "subject": election.description.strip() if election.description and election.description.strip() else election.name,
            "average_rating": avg_rating,
            "max_rating": 5,
            "total_responses": total_rated_ballots,
            "distribution": distribution,
        }
        base_result["candidates"] = options_list
        base_result["options"] = options_list
        return base_result

    # Custom or fallback
    else:
        candidate_list = []
        for c in raw_candidates:
            c_votes = db.scalar(
                select(func.count(Vote.id)).where(Vote.election_id == election.id, Vote.candidate_id == c.id)
            ) or 0
            pct = round(100.0 * c_votes / ballots_cast, 2) if ballots_cast > 0 else 0.0
            candidate_list.append({
                "id": str(c.id),
                "name": c.name,
                "party": c.party or "",
                "manifesto": c.manifesto or "",
                "photo_url": c.photo_url,
                "symbol_url": c.symbol_url,
                "votes": c_votes,
                "percentage": pct,
            })
        candidate_list.sort(key=lambda item: item["votes"], reverse=True)
        for idx, c in enumerate(candidate_list):
            c["rank"] = idx + 1
        base_result["candidates"] = candidate_list
        base_result["options"] = candidate_list
        return base_result
