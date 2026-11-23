package com.tallyup.expense.repository;

import com.tallyup.expense.entity.ExpenseSplit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, UUID> {
    List<ExpenseSplit> findByExpenseId(UUID expenseId);

    @Query("SELECT s.memberId, SUM(s.owedAmount) FROM ExpenseSplit s WHERE s.expense.groupId = :groupId GROUP BY s.memberId")
    List<Object[]> sumOwedByGroup(@Param("groupId") UUID groupId);
}
