#define STUDY_PLANNER_WASM
#include "../../daa_project1.c"

#include <assert.h>

int main(void) {
    static const struct {
        const char *subject;
        int start;
        int end;
        int importance;
    } sample[] = {
        {"Mathematics", 9 * 60, 12 * 60, 10},
        {"Java", 9 * 60, 10 * 60, 2},
        {"Python", 10 * 60, 11 * 60, 2},
        {"DAA", 11 * 60, 12 * 60, 2},
        {"DBMS", 12 * 60, 13 * 60, 5}
    };
    int i;

    planner_reset();
    for (i = 0; i < (int)(sizeof sample / sizeof sample[0]); i++) {
        assert(planner_add_session(sample[i].subject, sample[i].start,
                                   sample[i].end, sample[i].importance) == i + 1);
    }

    assert(planner_greedy_compute() == 4);
    assert(planner_greedy_importance() == 11);
    assert(planner_greedy_id_at(0) == 2);
    assert(planner_greedy_id_at(1) == 3);
    assert(planner_greedy_id_at(2) == 4);
    assert(planner_greedy_id_at(3) == 5);

    assert(planner_weighted_compute() == 2);
    assert(planner_weighted_importance() == 15);
    assert(planner_weighted_id_at(0) == 1);
    assert(planner_weighted_id_at(1) == 5);

    planner_reset();
    assert(planner_add_session("Minimum score", 9 * 60, 10 * 60, 1) == 1);
    assert(planner_add_session("Maximum score", 10 * 60, 11 * 60, 10) == 2);
    assert(planner_add_session("Below minimum", 11 * 60, 12 * 60, 0) == 0);
    assert(planner_add_session("Above maximum", 11 * 60, 12 * 60, 11) == 0);
    for (i = 2; i < 10; i++) {
        assert(planner_add_session("Session limit", 11 * 60, 12 * 60,
                                   1) == i + 1);
    }
    assert(planner_add_session("Eleventh session", 12 * 60, 13 * 60, 1) == 0);
    return 0;
}